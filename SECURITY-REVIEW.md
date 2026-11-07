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
  the constant `User-reported issue`; the auto-reported title embeds the
  sanitized `payload.message`, cut to the 256-character GitHub limit;
  auto-reported issues are deduplicated by fingerprint before a create;
  `buildAutoReportedIssueBody`, `buildUserReportedIssueBody` and the route
  error log reduce URLs to origin + path, redact sensitive patterns and
  truncate every field at write time (`shared/telemetryRedaction.ts`,
  `worker/docs/adr/0002-reports-are-redacted-before-storage.md`). Gaps: the
  schemas in `shared/errorReporting.ts` set no maximum length on `message`,
  `stackTrace`, `url` or `description`, so oversized requests are accepted
  (up to the 1 MiB body limit) and cut rather than refused; redaction is
  pattern-based and cannot catch every piece of personal text; and the token's
  scope is set in the Cloudflare dashboard, not checked in code. Issue
  bodies are later read by triage agents through `gh`, so text in them is a
  prompt-injection surface for those agents.
- **Public reads leak nothing.** Unauthenticated routes such as `GET
  /api/flags` (`worker/flags-route.ts`) return fixed, enumerated data and
  never echo `env`, request headers or free-form input.
