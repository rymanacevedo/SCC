#!/bin/bash
# PreToolUse guard for destructive git commands.
#
# Plain pushes of a feature branch are allowed so agents can push unattended.
# Still blocked: force pushes, deletes, mirrors, bulk pushes, and anything
# that targets a protected branch (main/master), including a bare
# `git push` from one.
#
# Tests: test/hooks/block-dangerous-git.test.ts

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

is_protected() {
  echo "$1" | grep -qxE "$PROTECTED_BRANCHES"
}

# Runs git against the repo the push targets: same env prefix, global
# options and cwd as the original command.
target_git() {
  (cd "$CWD" 2>/dev/null && env "${env_args[@]}" git "${global_args[@]}" "$@" 2>/dev/null)
}

current_branch() {
  target_git symbolic-ref --short -q HEAD
}

# Checks one `git ... push ...` invocation; words[start] is "git".
check_push() {
  local start=$1 i=$((start + 1)) n=${#words[@]} w
  global_args=()

  # Git global options before the subcommand. Values matter for -C,
  # --git-dir, --work-tree and -c, so keep them for target_git.
  while [ "$i" -lt "$n" ]; do
    w=${words[$i]}
    case "$w" in
      -C|-c|--git-dir|--work-tree|--namespace|--config-env|--super-prefix)
        global_args+=("$w" "${words[$((i + 1))]}"); i=$((i + 2)) ;;
      -*) global_args+=("$w"); i=$((i + 1)) ;;
      *) break ;;
    esac
  done
  [ "${words[$i]}" = "push" ] || return 1
  i=$((i + 1))

  local remote="" positional=()
  while [ "$i" -lt "$n" ]; do
    w=${words[$i]}
    case "$w" in
      --) ;;
      --force|--force=*|--force-with-lease|--force-with-lease=*|--force-if-includes|\
      --mirror|--delete|--prune|--all|--branches|--tags)
        block "uses '$w'" ;;
      --repo) remote=${words[$((i + 1))]}; i=$((i + 1)) ;;
      --repo=*) remote=${w#--repo=} ;;
      -o|--push-option|--receive-pack|--exec)
        i=$((i + 1)) ;;
      -[!-]*)
        # Short flags, possibly combined (e.g. -uf). Block -f and -d; -o
        # takes a value (attached or as the next word).
        local flags=${w#-}
        if [[ "$flags" == *o* ]]; then
          flags=${flags%%o*}
          [ "${w#*o}" = "" ] && i=$((i + 1))
        fi
        if [[ "$flags" == *f* || "$flags" == *d* ]]; then block "uses '$w'"; fi ;;
      -*) ;;
      *) positional+=("$w") ;;
    esac
    i=$((i + 1))
  done

  local refspecs
  if [ -n "$remote" ]; then
    refspecs=("${positional[@]}")
  else
    refspecs=("${positional[@]:1}")
  fi

  if [ "${#refspecs[@]}" -eq 0 ]; then
    # A bare push sends the current branch, unless push.default=matching
    # makes it send every branch that exists on the remote.
    local branch mode
    branch=$(current_branch)
    mode=$(target_git config --get push.default)
    if [ "$mode" = "matching" ]; then
      block "is a bare push with push.default=matching"
    fi
    if [ -z "$branch" ] || is_protected "$branch"; then
      block "pushes from '${branch:-detached HEAD}' without an explicit feature branch"
    fi
  fi

  local ref dest
  for ref in "${refspecs[@]}"; do
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
  done
  return 0
}

# Split into simple commands: chains, pipes, subshells, groups, command
# substitution. Quotes are dropped so `sh -c "git push ..."` is still seen.
SEGMENTS=$(echo "$COMMAND" | tr -d "\"'" | sed -E 's/(&|\||;|\(|\)|\{|\}|`|\$)/\n/g')

while IFS= read -r segment; do
  read -ra words <<< "$segment"
  echo "$segment" | grep -qE '(^|[[:space:]])push([[:space:]]|$)' || continue

  env_args=()
  for idx in "${!words[@]}"; do
    w=${words[$idx]}
    case "$w" in
      GIT_*=*) env_args+=("$w") ;;
    esac
    if [ "${w##*/}" = "git" ]; then
      check_push "$idx"
    fi
  done
done <<< "$SEGMENTS"

exit 0
