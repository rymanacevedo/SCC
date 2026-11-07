#!/bin/bash
# PreToolUse guard for destructive git commands.
#
# Plain pushes of a feature branch are allowed so agents can push unattended.
# Still blocked: force pushes, deletes/mirrors, and anything that targets a
# protected branch (main/master), including a bare `git push` from one.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

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

# Check every `git push` in the command, including chained ones (&&, ||, ;, |).
SEGMENTS=$(echo "$COMMAND" | sed -E 's/(&&|\|\||;|\|)/\n/g')

while IFS= read -r segment; do
  # Match `git push` and `git -C <dir> push`.
  if ! echo "$segment" | grep -qE '(^|[[:space:]])git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+push([[:space:]]|$)'; then
    continue
  fi

  read -ra words <<< "$segment"
  seen_push=0
  positional=()
  for w in "${words[@]}"; do
    if [ "$seen_push" -eq 0 ]; then
      [ "$w" = "push" ] && seen_push=1
      continue
    fi
    case "$w" in
      --force|--force-with-lease*|--force-if-includes|--mirror|--delete|--prune|--all|--tags)
        block "uses '$w'" ;;
      -[!-]*)
        # Short flags, possibly combined (e.g. -uf). Block -f and -d.
        if [[ "$w" == *f* || "$w" == *d* ]]; then block "uses '$w'"; fi ;;
      -*) ;;
      *) positional+=("$w") ;;
    esac
  done

  # positional[0] is the remote; the rest are refspecs.
  refspecs=("${positional[@]:1}")
  if [ "${#refspecs[@]}" -eq 0 ]; then
    # Bare push sends the current branch, so check what that is.
    branch=$(git -C "${CWD:-.}" symbolic-ref --short -q HEAD 2>/dev/null)
    if [ -z "$branch" ] || echo "$branch" | grep -qxE "$PROTECTED_BRANCHES"; then
      block "pushes from '${branch:-detached HEAD}' without an explicit feature branch"
    fi
  fi

  for ref in "${refspecs[@]}"; do
    case "$ref" in
      +*) block "force-pushes refspec '$ref'" ;;
      :*) block "deletes a remote ref with '$ref'" ;;
    esac
    dest="${ref##*:}"
    dest="${dest#refs/heads/}"
    if [ "$dest" = "HEAD" ]; then
      dest=$(git -C "${CWD:-.}" symbolic-ref --short -q HEAD 2>/dev/null)
      [ -z "$dest" ] && block "pushes a detached HEAD"
    fi
    if echo "$dest" | grep -qxE "$PROTECTED_BRANCHES"; then
      block "targets protected ref '$dest'"
    fi
  done
done <<< "$SEGMENTS"

exit 0
