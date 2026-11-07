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
# remote must be configured, the pushed ref must be a local branch (not a
# tag) and must not be main/master
# (compared by last path component), and config must not redirect the push.
#
# Pushes that never spell `push` are blocked too: in each simple command
# that runs git, the subcommand must be a real git command (git
# --list-cmds), so aliases and autocorrected typos are blocked wherever they
# are defined. Dynamic subcommands ($x, `...`), unknown global options, and
# push plumbing (send-pack, http-push) are blocked as well.
#
# Threat model: this hook catches agent mistakes, not adversaries; a script
# on disk can still run git. The `standard` ruleset on GitHub (pull request
# and status checks required, no force pushes, no bypass) is what enforces
# protection of main.
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
PUSH_PLUMBING="send-pack|http-push"
# Words that may precede git in a simple command: VAR=value, shell control
# words, wrappers and shells, and their options or numeric arguments.
COMMAND_PREFIX="[A-Za-z_][A-Za-z0-9_]*=.*|-.*|[0-9.]+[smhd]?|!|if|then|elif|else|do|while|until|env|sudo|exec|command|builtin|nohup|time|nice|xargs|timeout|stdbuf|watch|sh|bash|zsh|dash"

# Git global options (git --help): those taking a separate value, and flags.
GLOBAL_WITH_VALUE="-C|-c|--git-dir|--work-tree|--namespace|--config-env|--attr-source|--super-prefix"
GLOBAL_FLAGS="-v|--version|-h|--help|--list-cmds|--exec-path|--html-path|--man-path|--info-path|-p|--paginate|-P|--no-pager|--no-replace-objects|--no-lazy-fetch|--no-optional-locks|--no-advice|--bare|--literal-pathspecs|--glob-pathspecs|--noglob-pathspecs|--icase-pathspecs"

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
    if printf '%s\n%s\n' "$COMMAND" "$NORMALIZED" | grep -qE "$pattern"; then
      block "matches dangerous pattern '$pattern'"
    fi
  done
}

# simple_commands: NORMALIZED split into simple commands, one per line.
# Redirections are removed (git p>/dev/null runs p), each backtick becomes
# a '$' marker so a substituted subcommand counts as dynamic, and find's
# -exec starts a new command.
simple_commands() {
  printf '%s\n' "$NORMALIZED" | sed -E '
    s/`/ $\n/g
    s/[0-9]*[<>]+[&|]?[[:space:]]*[^[:space:];&|(){}<>]*/ /g
    s/[[:space:]]-(exec|execdir|ok|okdir)[[:space:]]/\n/g
    s/(;|&|\||\(|\)|\{|\})/\n/g'
}

# check_git_subcommands: in each simple command that runs git, block a
# subcommand that may push without spelling it.
check_git_subcommands() {
  if printf '%s\n' "$NORMALIZED" | grep -qE '(-c|--config-env)[[:space:]=]+alias\.|GIT_CONFIG_(PARAMETERS|COUNT|KEY_)'; then
    block "defines git config inline that can add aliases"
  fi

  local commands segment words n i j w program sub
  commands=" $(git --list-cmds=builtins,main,others 2>/dev/null | tr '\n' ' ') "

  while IFS= read -r segment; do
    read -ra words <<< "$segment"
    n=${#words[@]}
    i=0
    while [ "$i" -lt "$n" ] && [[ "${words[$i]}" =~ ^($COMMAND_PREFIX)$ ]]; do i=$((i + 1)); done
    program=${words[$i]##*/}
    [[ "$program" =~ ^git-($PUSH_PLUMBING)$ ]] && block "runs $program, which pushes without git push"
    [ "$program" = "git" ] || continue

    j=$((i + 1))
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
    [[ "$sub" =~ ^($PUSH_PLUMBING)$ ]] && block "runs git $sub, which pushes without git push"
    [[ "$commands" == *" $sub "* ]] || block "runs git '$sub', which is not a git command (an alias, or a typo git may autocorrect)"
  done < <(simple_commands)
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
  [ "$(repo_git config --type=bool --get push.followTags)" = "true" ] && block "relies on push.followTags=true, which also pushes tags"
  return 0
}

# check_push_target: configured remote, and a local branch (not a tag or
# other ref) that is not protected or a detached HEAD.
check_push_target() {
  if [ -n "$REMOTE" ]; then
    repo_git remote | grep -qxF -- "$REMOTE" || block "pushes to '$REMOTE', which is not a configured remote"
  fi
  if [ -n "$BRANCH" ] && [ "$BRANCH" != "HEAD" ]; then
    repo_git show-ref --verify -q "refs/heads/$BRANCH" || block "pushes '$BRANCH', which is not a local branch"
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
