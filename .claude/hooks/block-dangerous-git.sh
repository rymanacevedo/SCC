#!/bin/bash
# PreToolUse guard for destructive git commands.
#
# Pushes use a strict grammar instead of trying to model the shell. A
# command that mentions `push` is allowed only when the whole command is
#
#   git push [-u|--set-upstream|-v|--verbose|-q|--quiet|-n|--dry-run] [<remote> [<branch>|HEAD]]
#
# built from [A-Za-z0-9 ._/-] only: no chaining, subshells, quotes,
# variables, env prefixes, git global options, refspec colons or `+`. The
# remote must be configured, the pushed branch must not be main/master
# (compared by last path component), and config must not redirect the push
# (push.default other than simple/current, remote.*.push, remote.*.mirror,
# push.recurseSubmodules, submodule.recurse). Anything else that mentions
# push is blocked; run the push as its own command.
#
# Tests: test/hooks/block-dangerous-git.test.ts (bun test skips dot-dirs,
# so the test cannot sit beside this file).

INPUT=$(cat)
COMMAND=$(printf '%s\n' "$INPUT" | jq -r '.tool_input.command')
CWD=$(printf '%s\n' "$INPUT" | jq -r '.cwd // empty')
CWD=${CWD:-$PWD}

PROTECTED_BRANCHES="main|master"
PUSH_FLAGS="-u|--set-upstream|-v|--verbose|-q|--quiet|-n|--dry-run"

block() {
  echo "BLOCKED: '$COMMAND' $1. The user has prevented you from doing this." >&2
  exit 2
}

repo_git() {
  git -C "$CWD" "$@" 2>/dev/null
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
  if printf '%s\n' "$COMMAND" | grep -qE "$pattern"; then
    block "matches dangerous pattern '$pattern'"
  fi
done

# Git aliases that expand to push hide the push from the grammar below.
# Aliases come from every config scope visible in the cwd's repo.
while IFS= read -r line; do
  name=${line%% *}
  name=${name#alias.}
  value=${line#* }
  if printf '%s\n' "$value" | grep -qwE 'push' && printf '%s\n' "$COMMAND" | grep -qwE "git" &&
    printf '%s\n' "$COMMAND" | grep -qE "(^|[^[:alnum:]_.-])${name//./\\.}([^[:alnum:]_.-]|$)"; then
    block "may run git alias '$name', which expands to a push"
  fi
done < <(repo_git config --get-regexp '^alias\.')

printf '%s\n' "$COMMAND" | grep -qwE 'push' || exit 0

# --- Strict push grammar ---------------------------------------------------

SIMPLE_PUSH="run 'git push [-u] <remote> <branch>' as its own command"

# Whole command: one line, safe characters only.
TRIMMED=$(printf '%s\n' "$COMMAND" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')
[ "$(printf '%s\n' "$COMMAND" | wc -l)" -le 1 ] || block "spans multiple lines; $SIMPLE_PUSH"
[[ "$TRIMMED" =~ ^[A-Za-z0-9\ ._/-]+$ ]] || block "contains shell syntax or refspec characters; $SIMPLE_PUSH"

read -ra WORDS <<< "$TRIMMED"
[ "${WORDS[0]}" = "git" ] && [ "${WORDS[1]}" = "push" ] || block "is not a plain git push; $SIMPLE_PUSH"

positional=()
for w in "${WORDS[@]:2}"; do
  if [[ "$w" == -* ]]; then
    [[ "$w" =~ ^($PUSH_FLAGS)$ ]] || block "uses push option '$w', which is not on the allowlist"
  else
    positional+=("$w")
  fi
done
[ "${#positional[@]}" -le 2 ] || block "pushes more than one ref; $SIMPLE_PUSH"

remote=${positional[0]}
branch=${positional[1]}

if [ -n "$remote" ]; then
  repo_git remote | grep -qxF -- "$remote" || block "pushes to '$remote', which is not a configured remote"
fi

# Config that changes where a push lands.
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

if [ -z "$branch" ] || [ "$branch" = "HEAD" ]; then
  branch=$(repo_git symbolic-ref --short -q HEAD)
  [ -n "$branch" ] || block "pushes a detached HEAD"
fi
printf '%s\n' "${branch##*/}" | grep -qxE "$PROTECTED_BRANCHES" && block "targets protected branch '$branch'"

exit 0
