# Context

## Ready issues

!`gh issue list --state open --label Sandcastle --limit 100 --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`

## Open pull requests

!`gh pr list --state open --limit 100 --json number,title,body,headRefName,closingIssuesReferences`

# Task

Select at most {{MAX_ISSUES}} independent, unblocked issues from the ready-issues list. Prioritize bugs, then thin end-to-end features, polish, and refactors. Exclude issues already referenced by an open PR, including its closing-issue references and body. Read native GitHub issue dependencies and any referenced parent PRD when needed. Treat overlapping files or dependent APIs as dependencies and select only one of those issues this run.

Use the filtered list as the sole source of work. An empty list, or a list containing only blocked or already submitted work, produces an empty plan. Leave repository files, commits, issues, and PRs unchanged during planning.

# Output

Return numeric issue IDs as strings and their titles. Branch names are assigned by the runner.

<plan>{"issues": [{"id": "42", "title": "Fix auth bug"}]}</plan>

When nothing is actionable, return <plan>{"issues": []}</plan>.
