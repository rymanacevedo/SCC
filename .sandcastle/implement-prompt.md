# Task

Implement issue #{{TASK_ID}}: {{ISSUE_TITLE}} on branch {{BRANCH}}.

Read the issue with `gh issue view {{TASK_ID}} --json number,title,body,labels,comments` and any referenced parent PRD. Read AGENTS.md, relevant glossary/ADR files, source, and existing tests before changing code. Work only on this issue.

Use the repo's skills where applicable. Prefer shared logic over duplication. Add meaningful regression coverage when appropriate. This task explicitly instructs you to run `bun run typecheck` and `bun run test` for verification before committing; fix failures before signaling completion.

Commit the completed change using the repo's conventional-commit format. Include the issue reference and material decisions. Keep all changes committed. The reviewer and batch PR follow this phase; keep the issue open and keep this branch local.

If blocked, report the blocker and stop without the completion signal. When implementation and verification are complete, output <promise>COMPLETE</promise>.
