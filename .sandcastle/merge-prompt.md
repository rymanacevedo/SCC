# Task

You are on batch branch {{BATCH_BRANCH}}. Integrate these reviewed branches into this batch branch:

{{BRANCHES}}

The PR will target {{BASE_BRANCH}}. Keep that base branch unchanged.

For each listed branch, run `git merge --no-edit <branch>`. Resolve conflicts by reading both implementations and preserving each issue's intended behavior. After integration, run `bun run typecheck` and `bun run test`; this task explicitly instructs these checks. Fix integration failures and commit any fixes using conventional commits. Stop without the output signal if any listed branch cannot be integrated or verification fails.

# Pull request

Use the $pr skill: read `.agents/skills/pr/SKILL.md` and follow its Summary, Evidence, and Merge Danger template. Read the relevant package glossary for domain terms. Write the body to `/home/agent/tmp/sandcastle-pr.md` using actual verification evidence, with a small diagram or diff sketch. Report any missing before evidence honestly; never invent test results.

Include one `Closes #<id>` line for each issue below, so GitHub closes it when the PR is merged into the default branch:

{{ISSUES}}

Keep issue state unchanged. The runner verifies the combined branch, pushes the batch branch, and opens the PR after this phase succeeds. Keep publication and PR merging for the runner and human reviewer respectively.

# Output

After every listed branch is integrated, verification passes, changes are committed, and the PR body file exists, emit a concise PR title:

<pull-request>{"title": "fix: resolve the reviewed Sandcastle issues"}</pull-request>
