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
# remote must be configured and resolve to this repo on GitHub
# (TRUSTED_PUSH_URLS), the pushed ref must be a local branch (not a
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
# on disk can still run git, including a git-<name> helper on PATH, which
# git --list-cmds lists as a command. The `standard` ruleset on GitHub (pull request
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
# The only push destination agents may use: this repo on GitHub, in any of
# its URL spellings. Pinned here because remote URLs in the worktree's
# config can be changed by any earlier command.
TRUSTED_PUSH_URLS="(https://github\.com/|git@github\.com:|ssh://git@github\.com/)rymanacevedo/SCC(\.git)?/?"
PUSH_FLAGS="-u|--set-upstream|-v|--verbose|-q|--quiet|-n|--dry-run"
SIMPLE_PUSH="run 'git push [-u] <remote> <branch>' as its own command"
PUSH_PLUMBING="send-pack|http-push"
# Words that may precede the program of a simple command.
SHELL_PREFIX="[A-Za-z_][A-Za-z0-9_]*=.*|!|if|then|elif|else|do|while|until"
# Programs that run another command, matched by basename. Their options may
# take values, so the command they run is the first git word after them.
WRAPPERS="env|sudo|doas|su|exec|command|builtin|eval|nohup|time|nice|ionice|xargs|timeout|stdbuf|watch|setsid|flock|chroot|script|unbuffer|sh|bash|zsh|dash|ksh"
# Real git commands; any other subcommand is an alias or a typo.
GIT_COMMANDS=" $(git --list-cmds=builtins,main,others 2>/dev/null | tr '\n' ' ') "

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

# shell_words: COMMAND with quotes and backslashes removed, like NORMALIZED,
# but whitespace inside a quoted string becomes \x01 so the string stays one
# word (-c user.name="Jane Doe"). A quoted string that mentions git may be a
# script for an inner shell (sh -c '...'), so it is left to be split. One
# awk pass over tokens, so large heredocs stay fast.
shell_words() {
  printf '%s\n' "$COMMAND" | LC_ALL=C awk '
    function quoted(chunk) {
      gsub(/\\/, "", chunk)
      if (chunk !~ /(^|[^A-Za-z0-9_-])git([^A-Za-z0-9_-]|$)/) gsub(/[ \t\n]/, "\001", chunk)
      printf "%s", chunk
    }
    { s = s (NR > 1 ? "\n" : "") $0 }
    END {
      while (s != "") {
        if (match(s, /^[^"\047\\]+/)) printf "%s", substr(s, 1, RLENGTH)
        else if (match(s, /^\\./)) printf "%s", substr(s, 2, 1)
        else if (match(s, /^\047[^\047]*\047/)) quoted(substr(s, 2, RLENGTH - 2))
        else if (match(s, /^"([^"\\]|\\.)*"/)) quoted(substr(s, 2, RLENGTH - 2))
        else { rest = substr(s, 2); gsub(/\\/, "", rest); printf "%s", rest; RLENGTH = length(s) }
        s = substr(s, RLENGTH + 1)
      }
      print ""
    }'
}

# simple_commands: shell_words split into simple commands, one per line.
# Redirections are removed (git p>/dev/null runs p), each backtick becomes
# a '$' marker so a substituted subcommand counts as dynamic, and find's
# -exec starts a new command.
simple_commands() {
  shell_words | sed -E '
    s/`/ $\n/g
    s/[0-9]*[<>]+[&|]?[[:space:]]*[^[:space:];&|(){}<>]*/ /g
    s/[[:space:]]-(exec|execdir|ok|okdir)[[:space:]]/\n/g
    s/(;|&|\||\(|\)|\{|\})/\n/g'
}

# program_index <var> <words...>: set <var> to the index of the program a
# simple command runs, past VAR=value and control words; for a wrapper, its
# first git word. Sets a variable rather than printing, to avoid a fork per
# command.
program_index() {
  local out=$1; shift
  local words=("$@") i=0 n=$#
  while [ "$i" -lt "$n" ] && [[ "${words[$i]}" =~ ^($SHELL_PREFIX)$ ]]; do i=$((i + 1)); done
  if [[ "${words[$i]##*/}" =~ ^($WRAPPERS)$ ]]; then
    while [ "$i" -lt "$n" ] && ! [[ "${words[$i]##*/}" =~ ^git(-($PUSH_PLUMBING))?$ ]]; do i=$((i + 1)); done
  fi
  printf -v "$out" '%s' "$i"
}

# check_git_invocation <args after git...>: block a subcommand that may push
# without spelling it.
check_git_invocation() {
  while [ "$#" -gt 0 ] && [[ "$1" == -* ]]; do
    if [[ "$1" =~ ^($GLOBAL_WITH_VALUE)$ ]]; then shift 2 || shift
    elif [[ "$1" =~ ^($GLOBAL_WITH_VALUE)= || "$1" =~ ^($GLOBAL_FLAGS)(=.*)?$ ]]; then shift
    else block "uses git option '$1' before the subcommand, which the hook does not know"
    fi
  done
  local sub=$1
  [ -n "$sub" ] || return 0
  [[ "$sub" == *'$'* ]] && block "runs a dynamic git subcommand '$sub'"
  [[ "$sub" =~ ^($PUSH_PLUMBING)$ ]] && block "runs git $sub, which pushes without git push"
  [[ "$GIT_COMMANDS" == *" $sub "* ]] || block "runs git '$sub', which is not a git command (an alias, or a typo git may autocorrect)"
  return 0
}

# check_git_subcommands: check every simple command that runs git.
check_git_subcommands() {
  if printf '%s\n' "$NORMALIZED" | grep -qE '(-c|--config-env)[[:space:]=]+alias\.|GIT_CONFIG_(PARAMETERS|COUNT|KEY_)'; then
    block "defines git config inline that can add aliases"
  fi

  local segment words at program
  while IFS= read -r segment; do
    [[ "$segment" == *git* ]] || continue
    read -ra words <<< "$segment"
    [ "${#words[@]}" -gt 0 ] || continue
    program_index at "${words[@]}"
    program=${words[$at]##*/}
    [[ "$program" =~ ^git-($PUSH_PLUMBING)$ ]] && block "runs $program, which pushes without git push"
    [ "$program" = "git" ] && check_git_invocation "${words[@]:at+1}"
  done < <(simple_commands)
  return 0
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
  # Keys are matched in git's canonical lower case.
  mapping=$(repo_git config --get-regexp '^(remote\..*\.(push|pushurl|mirror)|url\..*\.pushinsteadof)$' | head -1)
  [ -z "$mapping" ] || block "uses config that redirects the push (push refspec, push URL, pushInsteadOf or mirror: $mapping)"
  recurse=$(repo_git config --get push.recurseSubmodules)
  case "$recurse" in
    ""|no|false|check) ;;
    *) block "relies on push.recurseSubmodules=$recurse" ;;
  esac
  [ "$(repo_git config --type=bool --get submodule.recurse)" = "true" ] && block "relies on submodule.recurse=true"
  [ "$(repo_git config --type=bool --get push.followTags)" = "true" ] && block "relies on push.followTags=true, which also pushes tags"
  return 0
}

# check_push_target: a configured remote (also when implied by config), and
# a local branch (not a tag or other ref) that is not protected or a
# detached HEAD.
check_push_target() {
  if [ -n "$BRANCH" ] && [ "$BRANCH" != "HEAD" ]; then
    repo_git show-ref --verify -q "refs/heads/$BRANCH" || block "pushes '$BRANCH', which is not a local branch"
  fi
  if [ -z "$BRANCH" ] || [ "$BRANCH" = "HEAD" ]; then
    BRANCH=$(repo_git symbolic-ref --short -q HEAD)
    [ -n "$BRANCH" ] || block "pushes a detached HEAD"
  fi
  printf '%s\n' "${BRANCH##*/}" | grep -qxE "$PROTECTED_BRANCHES" && block "targets protected branch '$BRANCH'"
  if [ -z "$REMOTE" ]; then
    REMOTE=$(repo_git config --get "branch.$BRANCH.pushRemote" || repo_git config --get remote.pushDefault ||
      repo_git config --get "branch.$BRANCH.remote" || echo origin)
  fi
  repo_git remote | grep -qxF -- "$REMOTE" || block "pushes to '$REMOTE', which is not a configured remote"
  check_push_url "$REMOTE"
}

# check_push_url <remote>: every URL the push goes to must be this repo on
# GitHub. A remote may list several URLs and git pushes to all of them;
# get-url --push --all applies pushurl and insteadOf rewrites.
check_push_url() {
  local url urls
  urls=$(repo_git remote get-url --push --all "$1")
  [ -n "$urls" ] || block "pushes to '$1', whose URL cannot be resolved"
  while IFS= read -r url; do
    [[ "$url" =~ ^($TRUSTED_PUSH_URLS)$ ]] || block "pushes to '$url', which is not this repo's GitHub remote"
  done <<< "$urls"
  return 0
}

check_dangerous_patterns
# Fast path: a command that never mentions git or push cannot run either.
has_word "$NORMALIZED" 'git|push' || exit 0
check_git_subcommands
has_word "$NORMALIZED" push || exit 0
parse_push
check_push_config
check_push_target
exit 0
