#!/bin/bash
# PreToolUse guard for destructive git commands.
#
# Plain pushes of a feature branch are allowed so agents can push unattended.
# Push options are an allowlist: anything unrecognised (including git's
# long-option abbreviations such as --del) is blocked. Also blocked: pushes
# that target main/master, and pushes whose destination git would take from
# config (remote.*.push, remote.*.mirror, push.default other than
# simple/current) because the hook cannot see where those land.
#
# Tests: test/hooks/block-dangerous-git.test.ts (bun test skips dot-dirs,
# so the test cannot sit beside this file).

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
CWD=${CWD:-$PWD}

PROTECTED_BRANCHES="main|master"

block() {
  echo "BLOCKED: '$COMMAND' $1. The user has prevented you from doing this." >&2
  exit 2
}

DANGEROUS_PATTERNS=(
  "git reset --hard"
  "git clean -fd"
  "git clean -f"
  "git branch -D"
  "git checkout \."
  "git restore \."
  "reset --hard"
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qE "$pattern"; then
    block "matches dangerous pattern '$pattern'"
  fi
done

# --- Per-invocation state --------------------------------------------------
# Reset by check_invocation for every `git` word; written only by the parse_*
# helpers below and read by target_git and the check_* helpers.
WORDS=()        # words of the current simple command
ENV_ARGS=()     # GIT_*=... assignments preceding git
GLOBAL_ARGS=()  # git options before the subcommand (-C, -c, --git-dir, ...)
SUBCOMMAND_AT=0 # index in WORDS of the subcommand
REMOTE=""       # explicit remote (positional or --repo), may be empty
REFSPECS=()     # explicit refspecs

is_protected() {
  echo "$1" | grep -qxE "$PROTECTED_BRANCHES"
}

# Runs git against the repo the push targets: same env prefix, global
# options and cwd as the original command.
target_git() {
  (cd "$CWD" 2>/dev/null && env "${ENV_ARGS[@]}" git "${GLOBAL_ARGS[@]}" "$@" 2>/dev/null)
}

current_branch() {
  target_git symbolic-ref --short -q HEAD
}

# parse_globals <git-index>: fills GLOBAL_ARGS and SUBCOMMAND_AT.
parse_globals() {
  local i=$(($1 + 1))
  local n=${#WORDS[@]}
  GLOBAL_ARGS=()
  while [ "$i" -lt "$n" ]; do
    case "${WORDS[$i]}" in
      -C|-c|--git-dir|--work-tree|--namespace|--config-env|--super-prefix)
        GLOBAL_ARGS+=("${WORDS[$i]}" "${WORDS[$((i + 1))]}"); i=$((i + 2)) ;;
      -*) GLOBAL_ARGS+=("${WORDS[$i]}"); i=$((i + 1)) ;;
      *) break ;;
    esac
  done
  SUBCOMMAND_AT=$i
}

# parse_push_args: reads WORDS after SUBCOMMAND_AT, fills REMOTE and
# REFSPECS, and blocks on any option outside the allowlist.
parse_push_args() {
  local i=$((SUBCOMMAND_AT + 1))
  local n=${#WORDS[@]}
  local w flags positional=() repo_flag=0
  REMOTE=""
  while [ "$i" -lt "$n" ]; do
    w=${WORDS[$i]}
    case "$w" in
      --) ;;
      --set-upstream|--quiet|--verbose|--progress|--no-progress|--verify|\
      --no-verify|--follow-tags|--no-follow-tags|--atomic|--no-atomic|\
      --dry-run|--porcelain|--thin|--no-thin|--signed|--signed=*|--no-signed|\
      --ipv4|--ipv6|--recurse-submodules=*|--no-recurse-submodules|\
      --push-option=*) ;;
      --push-option) i=$((i + 1)) ;;
      --repo) REMOTE=${WORDS[$((i + 1))]}; repo_flag=1; i=$((i + 1)) ;;
      --repo=*) REMOTE=${w#--repo=}; repo_flag=1 ;;
      --*) block "uses push option '$w', which is not on the allowlist" ;;
      -*)
        # Short flags, possibly combined (e.g. -uv). -o takes a value,
        # attached or as the next word.
        flags=${w#-}
        if [[ "$flags" == *o* ]]; then
          [ -z "${flags#*o}" ] && i=$((i + 1))
          flags=${flags%%o*}
        fi
        [[ "$flags" =~ ^[uqvn46]*$ ]] || block "uses push flag '$w', which is not on the allowlist" ;;
      *) positional+=("$w") ;;
    esac
    i=$((i + 1))
  done

  if [ "$repo_flag" -eq 1 ]; then
    REFSPECS=("${positional[@]}")
  else
    REMOTE=${positional[0]}
    REFSPECS=("${positional[@]:1}")
  fi
}

# check_push_config: block when config, not the command, decides the
# destination. Checks every remote, since the push remote can itself come
# from config (pushRemote, pushDefault, branch.*.remote).
check_push_config() {
  local mode mappings
  mode=$(target_git config --get push.default)
  case "$mode" in
    ""|simple|current) ;;
    *) block "relies on push.default=$mode" ;;
  esac
  mappings=$(target_git config --get-regexp '^remote\..*\.(push|mirror)$')
  if [ -n "$mappings" ]; then
    block "uses a remote with configured push refspecs or mirror ($(echo "$mappings" | head -1))"
  fi
}

# check_refspec <refspec>: block force, delete, wildcard and protected targets.
check_refspec() {
  local ref=$1 dest
  case "$ref" in
    +*) block "force-pushes refspec '$ref'" ;;
    :*) block "deletes a remote ref with '$ref'" ;;
    *'*'*) block "uses wildcard refspec '$ref'" ;;
  esac
  dest=${ref##*:}
  dest=${dest#refs/heads/}
  if [ "$dest" = "HEAD" ] || [ "$dest" = "@" ]; then
    dest=$(current_branch)
    [ -z "$dest" ] && block "pushes a detached HEAD"
  fi
  if is_protected "$dest"; then
    block "targets protected ref '$dest'"
  fi
}

# check_invocation <git-index>: checks one `git ...` invocation in WORDS.
check_invocation() {
  parse_globals "$1"
  [ "${WORDS[$SUBCOMMAND_AT]}" = "push" ] || return 0
  parse_push_args
  check_push_config

  if [ "${#REFSPECS[@]}" -eq 0 ]; then
    # With push.default simple/current a bare push sends the current branch
    # to the same name.
    local branch
    branch=$(current_branch)
    if [ -z "$branch" ] || is_protected "$branch"; then
      block "pushes from '${branch:-detached HEAD}' without an explicit feature branch"
    fi
  fi

  local ref
  for ref in "${REFSPECS[@]}"; do
    check_refspec "$ref"
  done
}

# Split into simple commands: chains, pipes, subshells, groups, command
# substitution. Quotes are dropped so `sh -c "git push ..."` is still seen.
SEGMENTS=$(echo "$COMMAND" | tr -d "\"'" | sed -E 's/(&|\||;|\(|\)|\{|\}|`|\$)/\n/g')

while IFS= read -r segment; do
  echo "$segment" | grep -qE '(^|[[:space:]])push([[:space:]]|$)' || continue
  read -ra WORDS <<< "$segment"
  ENV_ARGS=()
  for idx in "${!WORDS[@]}"; do
    case "${WORDS[$idx]}" in
      GIT_*=*) ENV_ARGS+=("${WORDS[$idx]}") ;;
    esac
    if [ "${WORDS[$idx]##*/}" = "git" ]; then
      check_invocation "$idx"
    fi
  done
done <<< "$SEGMENTS"

exit 0
