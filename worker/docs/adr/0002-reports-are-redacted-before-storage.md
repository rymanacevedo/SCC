---
status: accepted
date: 2026-11-07
---

# Reports are reduced, redacted and truncated before storage, on both sides

Error telemetry (`/api/errors`) and User reports (`/api/report-issue`) used to reach GitHub issues and Workers Logs as sent: full `location.href` with query string and fragment, raw messages, raw stacks, raw upstream response snippets. A resume builder's errors and free-text descriptions can easily carry an email address, a phone number, or a token. We decided that every report is **sanitized before it is stored**, by one shared module (`shared/telemetryRedaction.ts`, applied per field by `sanitizeErrorTelemetry` and `sanitizeUserIssueReport` in `shared/errorReporting.ts`):

- URLs are reduced to origin + path: no credentials, query string or fragment.
- Free text (messages, stacks, descriptions, logged GitHub response snippets) is redacted: email addresses, phone numbers, `Bearer` tokens, long hex or base64url secrets, `name=value` / `name: value` pairs whose name looks like a credential (`token`, `key`, `secret`, `password`, `auth`, `session`, `cookie`, …), and the query or fragment of any URL inside the text. Each match becomes `[redacted]`.
- Every field is then truncated to a fixed limit with a visible `… [truncated]` marker (issue fields: URL 2,000, message 1,000, stack 8,000, description 8,000 characters; log fields: URL 2,000, message 1,000, stack 4,000).

The browser sanitizes in the API client before sending, so the data never crosses the wire. The Worker sanitizes again before building an issue body, a fingerprint, or a log line, because it never trusts the client. Sanitizing is idempotent, so running it twice changes nothing. The telemetry fingerprint is computed on sanitized values, so dedup is not split by query strings or by redacted personal data.

## Where reports are stored and who can read them

| Store | What lands there | Who can read it |
|-------|------------------|-----------------|
| GitHub issues in this repository (`GITHUB_REPO`), labelled `auto-reported` or `user-reported` | One issue per Error telemetry fingerprint (deduped against open issues) and one per User report | Anyone who can read the repository's issues, plus the holder of the Worker's `GITHUB_TOKEN` |
| Workers Logs for this Worker | One `console.error` line per failed report route (route, category, timestamp, path-only URL, error name, stack, messages, GitHub status and snippet) | Members of the Cloudflare account with access to the Worker's logs |

Redaction runs before either store is written. It is pattern-based, so it lowers the risk but cannot promise that nothing personal ever slips through (a name typed into a description, for example, is kept).

## Retention

> **TODO (maintainer decision):** retention period for report issues and Workers Logs is not decided yet. Record it here once confirmed. Until then, GitHub issues stay until closed or deleted by hand, and Workers Logs follow the account's default log retention.

## Consequences

- Patterns are deliberately conservative so ordinary messages and stack frames (file and function names, line and column) stay readable. A credential-like name followed by `:` can over-redact (e.g. `Cache key: foo`), which is the trade we accept.
- Redaction reads at most four times a field's limit, so an oversized field costs bounded CPU however large the request body was. Rejecting oversized requests at the schema is separate work (#248).

Decided in https://github.com/rymanacevedo/SCC/issues/250.
