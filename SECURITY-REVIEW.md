# Security review concerns

The repo-specific concern is the lethal trifecta for AI agents. SCC holds
private data, takes in untrusted content, and talks to external services,
and the three must never be reachable from one another without a human in
between. Each bullet below records the code paths involved, what is in
place today and what is still a gap.

- **Private data stays in the worker.** `OPENAI_API_KEY`, `GITHUB_TOKEN` and
  `GITHUB_REPO` are read only through `worker/lib/environment.ts` and used
  only in `worker/services/model.ts` and `worker/services/github.ts`. Nothing
  under `app/` or `shared/` names them, and no response body, thrown error,
  log line or GitHub issue body carries their values. The user's resume
  answers, posted to `/api/summaries`, `/api/skills` and `/api/experience`
  (`worker/router.ts`), go to the model and come back to the same user; they
  are not persisted, logged, or copied into any other outbound call.
- **Untrusted content drives no outbound action.** Request bodies, model
  output and browser telemetry are all untrusted. The generation routes in
  `worker/services/ai.ts` give the model no tools, and its text goes back to
  the client only. The gap would open if model output could pick a URL, a
  label, a recipient or a follow-up call.
- **The GitHub write path.** `/api/errors` and `/api/report-issue` write
  browser-controlled payloads into GitHub issues with the repo token
  (`worker/services/github.ts`). In place: labels are fixed server-side
  (`bug` plus `auto-reported` or `user-reported`); the user-reported title is
  the constant `User-reported issue`; the auto-reported title is the error
  class name and path (`Auto-reported error: TypeError at /summary`), cut
  to the 256-character GitHub limit;
  auto-reported issues are deduplicated by fingerprint before a create;
  `buildAutoReportedIssueBody`, `buildUserReportedIssueBody` and the route
  error log store structure only: a canonical timestamp, the URL as
  plain path under a synthetic origin, the error class name and canonical
  stack frames.
  Error messages and GitHub error bodies are free text and are never
  stored, only their length, and a User report asks for no text at all
  (`shared/telemetryRedaction.ts`,
  `shared/stackFrames.ts`,
  `docs/adr/0001-reports-are-redacted-before-storage.md`); every
  field fits its `REPORT_FIELD_LIMITS` cap, the schemas refuse a field over
  that cap, and the route body limit is derived from them. Gaps: a plain-word
  path segment can still be personal (`/u/janedoe`); no real host is kept;
  and the
  token's
  scope is set in the Cloudflare dashboard, not checked in code. Issue
  bodies are later read by triage agents through `gh`; with free text gone,
  the browser controls only identifiers and plain path segments in them,
  which both body builders still fence as code (`worker/lib/markdown.ts`),
  and agents must still treat them as untrusted.
- **Public reads leak nothing.** Unauthenticated routes such as `GET
  /api/flags` (`worker/flags-route.ts`) return fixed, enumerated data and
  never echo `env`, request headers or free-form input.
