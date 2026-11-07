#!/bin/bash
# PreToolUse guard for destructive git commands.
#
# Pushes use a strict grammar instead of trying to model the shell. A
# command that mentions `push` (after removing quotes and backslashes, so
# pu''sh and pu\sh count) is allowed only when the whole command is
#
#   git push [-u|--set-upstream|-v|--verbose|-q|--quiet|-n|--dry-run] [<remote> [<branch>|HEAD]]
#
# built from [A-Za-z0-9 ._/-] only: no chaining, subshells, quotes,
# variables, env prefixes, git global options, refspec colons or `+`. The
# remote must be configured, the pushed branch must not be main/master
# (compared by last path component), and config must not redirect the push.
#
# Pushes that never spell `push` are blocked too: every git invocation's
# subcommand is resolved, and it is blocked when it is dynamic ($x, `...`),
# follows an unknown global option, or is an alias that expands to push
# (alias chains are followed). Aliases defined inline (-c alias.*,
# GIT_CONFIG_*) are blocked.
#
# Tests: test/hooks/block-dangerous-git.test.ts (bun test skips dot-dirs,
# so the test cannot sit beside this file).

INPUT=$(cat)
COMMAND=$(printf '%s\n' "$INPUT" | jq -r '.tool_input.command')
CWD=$(printf '%s\n' "$INPUT" | jq -r '.cwd // empty')
CWD=${CWD:-$PWD}

# COMMAND without quotes and backslashes, which the shell would remove.
NORMALIZED=$(printf '%s\n' "$COMMAND" | tr -d "'\"\\\\")

PROTECTED_BRANCHES="main|master"
PUSH_FLAGS="-u|--set-upstream|-v|--verbose|-q|--quiet|-n|--dry-run"
SIMPLE_PUSH="run 'git push [-u] <remote> <branch>' as its own command"

# Git global options (git --help): those taking a separate value, and flags.
GLOBAL_WITH_VALUE="-C|-c|--git-dir|--work-tree|--namespace|--config-env|--attr-source|--super-prefix"
GLOBAL_FLAGS="-v|--version|-h|--help|--exec-path|--html-path|--man-path|--info-path|-p|--paginate|-P|--no-pager|--no-replace-objects|--no-lazy-fetch|--no-optional-locks|--no-advice|--bare|--literal-pathspecs|--glob-pathspecs|--noglob-pathspecs|--icase-pathspecs"

block() {
  echo "BLOCKED: '$COMMAND' $1. The user has prevented you from doing this." >&2
  exit 2
}

repo_git() {
  git -C "$CWD" "$@" 2>/dev/null
}

has_word() {
  printf '%s\n' "$1" | grep -qwE "$2"
}

check_dangerous_patterns() {
  local pattern patterns=(
    "git reset --hard"
    "git clean -fd"
    "git clean -f"
    "git branch -D"
    "git checkout \."
    "git restore \."
    "reset --hard"
  )
  for pattern in "${patterns[@]}"; do
    if printf '%s\n' "$COMMAND" | grep -qE "$pattern"; then
      block "matches dangerous pattern '$pattern'"
    fi
  done
}

# push_aliases: prints every alias that expands to push, directly or through
# a chain of aliases (alias.p=publish, alias.publish=push).
push_aliases() {
  local names=() values=() found=() value_words=() line changed=1 i word
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    names+=("${line%% *}")
    values+=("$(printf '%s\n' "${line#* }" | tr -d "'\"\\\\!")")
  done < <(repo_git config --get-regexp '^alias\.' | sed 's/^alias\.//')

  while [ "$changed" -eq 1 ]; do
    changed=0
    for i in "${!names[@]}"; do
      [[ " ${found[*]} " == *" ${names[$i]} "* ]] && continue
      read -ra value_words <<< "${values[$i]}"
      for word in "${value_words[@]}"; do
        if [ "$word" = "push" ] || [[ " ${found[*]} " == *" $word "* ]]; then
          found+=("${names[$i]}"); changed=1; break
        fi
      done
    done
  done
  printf '%s\n' "${found[@]}"
}

# check_git_subcommands: resolve each git invocation's subcommand and block
# the ones that may push without spelling it.
check_git_subcommands() {
  if printf '%s\n' "$NORMALIZED" | grep -qE '(-c|--config-env)[[:space:]=]+alias\.|GIT_CONFIG_(PARAMETERS|COUNT|KEY_)'; then
    block "defines git config inline that can add aliases"
  fi

  local aliases segment words i n w sub
  aliases=" $(push_aliases | tr '\n' ' ') "

  while IFS= read -r segment; do
    read -ra words <<< "$segment"
    n=${#words[@]}
    for ((i = 0; i < n; i++)); do
      [ "${words[$i]##*/}" = "git" ] || continue
      local j=$((i + 1))
      while [ "$j" -lt "$n" ] && [[ "${words[$j]}" == -* ]]; do
        w=${words[$j]}
        if [[ "$w" =~ ^($GLOBAL_WITH_VALUE)$ ]]; then j=$((j + 2))
        elif [[ "$w" =~ ^($GLOBAL_WITH_VALUE)= || "$w" =~ ^($GLOBAL_FLAGS)(=.*)?$ ]]; then j=$((j + 1))
        else block "uses git option '$w' before the subcommand, which the hook does not know"
        fi
      done
      sub=${words[$j]}
      [ -n "$sub" ] || continue
      [[ "$sub" == *'$'* ]] && block "runs a dynamic git subcommand '$sub'"
      [[ "$aliases" == *" $sub "* ]] && block "runs git alias '$sub', which expands to a push"
    done
  done < <(printf '%s\n' "$NORMALIZED" | sed -E 's/(;|&|\||\(|\)|`|\{|\})/\n/g')
}

# parse_push: check the whole command against the strict grammar and set
# REMOTE and BRANCH.
parse_push() {
  local trimmed words w positional=()
  trimmed=$(printf '%s\n' "$COMMAND" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')
  [ "$(printf '%s\n' "$COMMAND" | wc -l)" -le 1 ] || block "spans multiple lines; $SIMPLE_PUSH"
  [[ "$trimmed" =~ ^[A-Za-z0-9\ ._/-]+$ ]] || block "contains shell syntax or refspec characters; $SIMPLE_PUSH"

  read -ra words <<< "$trimmed"
  [ "${words[0]}" = "git" ] && [ "${words[1]}" = "push" ] || block "is not a plain git push; $SIMPLE_PUSH"

  for w in "${words[@]:2}"; do
    if [[ "$w" == -* ]]; then
      [[ "$w" =~ ^($PUSH_FLAGS)$ ]] || block "uses push option '$w', which is not on the allowlist"
    else
      positional+=("$w")
    fi
  done
  [ "${#positional[@]}" -le 2 ] || block "pushes more than one ref; $SIMPLE_PUSH"
  REMOTE=${positional[0]}
  BRANCH=${positional[1]}
}

# check_push_config: block config that changes where the push lands.
check_push_config() {
  local mode mapping recurse
  mode=$(repo_git config --get push.default)
  case "$mode" in
    ""|simple|current) ;;
    *) block "relies on push.default=$mode" ;;
  esac
  mapping=$(repo_git config --get-regexp '^remote\..*\.(push|mirror)$' | head -1)
  [ -z "$mapping" ] || block "uses a remote with configured push refspecs or mirror ($mapping)"
  recurse=$(repo_git config --get push.recurseSubmodules)
  case "$recurse" in
    ""|no|false|check) ;;
    *) block "relies on push.recurseSubmodules=$recurse" ;;
  esac
  [ "$(repo_git config --type=bool --get submodule.recurse)" = "true" ] && block "relies on submodule.recurse=true"
  return 0
}

# check_push_target: configured remote, not a protected or detached branch.
check_push_target() {
  if [ -n "$REMOTE" ]; then
    repo_git remote | grep -qxF -- "$REMOTE" || block "pushes to '$REMOTE', which is not a configured remote"
  fi
  if [ -z "$BRANCH" ] || [ "$BRANCH" = "HEAD" ]; then
    BRANCH=$(repo_git symbolic-ref --short -q HEAD)
    [ -n "$BRANCH" ] || block "pushes a detached HEAD"
  fi
  printf '%s\n' "${BRANCH##*/}" | grep -qxE "$PROTECTED_BRANCHES" && block "targets protected branch '$BRANCH'"
  return 0
}

check_dangerous_patterns
check_git_subcommands
has_word "$NORMALIZED" push || exit 0
parse_push
check_push_config
check_push_target
exit 0
