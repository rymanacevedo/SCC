# Security review concerns

One concern: the lethal trifecta for AI agents. SCC holds private data,
takes in untrusted content, and talks to external services, and the three
must never be reachable from one another without a human in between. The
reviewer checks every PR against the paths below.

- **Private data stays in the worker.** `OPENAI_API_KEY`, `GITHUB_TOKEN` and
  `GITHUB_REPO` are read only through `worker/lib/environment.ts` and used only
  in `worker/services/model.ts` and `worker/services/github.ts`. Nothing under
  `app/` or `shared/` names them, and no response body, thrown error, log line
  or GitHub issue body carries their values. The user's resume answers, posted
  to `/api/summaries`, `/api/skills` and `/api/experience`
  (`worker/router.ts`), are sent to the model and returned to the same user;
  they are not persisted, logged, or copied into any other outbound call.
- **Untrusted content drives no outbound action.** Request bodies, model
  output and browser telemetry are all untrusted. The generation routes in
  `worker/services/ai.ts` give the model no tools, and its text goes back to
  the client only; a change that lets model output pick a URL, a label, a
  recipient or a follow-up call is the trifecta closing.
- **The GitHub write path is bounded.** `/api/errors` and `/api/report-issue`
  write browser-controlled payloads into GitHub issues with the repo token
  (`worker/services/github.ts`, `createAutoReportedIssue`,
  `createUserReportedIssue`). The schemas in `shared/` bound the fields and
  their lengths; titles, labels and assignees are fixed server-side; the
  token's scope covers issues only. Issue bodies are later read by triage
  agents through `gh`, so text in them is a prompt-injection surface: nothing
  an agent reads from an issue may lead to an action without a human review
  step, and a PR must not widen what a browser can put into one.
- **Public reads leak nothing.** Unauthenticated routes such as `GET
  /api/flags` return fixed, enumerated data and never echo `env`, request
  headers or free-form input.
