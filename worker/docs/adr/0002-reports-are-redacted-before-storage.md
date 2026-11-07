---
status: accepted
date: 2026-11-07
---

# Reports are reduced, redacted and truncated before storage, on both sides

Error telemetry (`/api/errors`) and User reports (`/api/report-issue`) used to reach GitHub issues and Workers Logs as sent: full `location.href` with query string and fragment, raw messages, raw stacks, raw upstream response snippets. A resume builder's errors and free-text descriptions can easily carry an email address, a phone number, or a token. We decided that every report is **sanitized before it is stored**, by one shared module (`shared/telemetryRedaction.ts`, applied per field by `sanitizeErrorTelemetry` and `sanitizeUserIssueReport` in `shared/errorReporting.ts`):

- URLs are reduced to origin + path: no credentials, query string or fragment.
- Free text (messages, stacks, descriptions, logged GitHub response snippets, the Worker entry's unhandled-error log) is redacted. Covered: email addresses; phone numbers (international, North American, trunk-prefixed, 7-digit local); `Bearer` tokens and JWTs; well-known key prefixes (`sk-`, `gh*_`, `xox*-`, `AKIA`); long hex, base64 or base64url secrets; `name=value` / `name: value` pairs (quoted or not) where a word of the name is a credential word (`token`, `key`, `secret`, `password`, `auth`, `session`, `cookie`, …; `author` or `keyboard` do not count); and the query or fragment of any absolute URL or root-relative path inside the text. Each match becomes `[redacted]`.
- Every field is then truncated to a fixed limit with a visible `… [truncated]` marker (`REPORT_FIELD_MAX`: URL 2,000, message 1,000, stack 8,000, description 8,000 characters; a logged stack is capped at 4,000).

The browser sanitizes in the API client before sending, so the data never crosses the wire. The Worker sanitizes again before building an issue body, a fingerprint, or a log line, because it never trusts the client. A second pass can only redact more, never less. The Worker sanitizes Error telemetry once per request (`SanitizedErrorTelemetry`) and uses that one value for the dedup lookup, the title and the body, so the fingerprint written into an issue always matches the one looked up. The fingerprint is computed on sanitized values, so dedup is not split by query strings or by redacted personal data.

## Where reports are stored and who can read them

| Store | What lands there | Who can read it |
|-------|------------------|-----------------|
| GitHub issues in this repository (`GITHUB_REPO`), labelled `auto-reported` or `user-reported` | One issue per Error telemetry fingerprint (deduped against open issues) and one per User report | Anyone who can read the repository's issues, plus the holder of the Worker's `GITHUB_TOKEN` |
| Workers Logs for this Worker | One `console.error` line per failed report route (route, category, timestamp, path-only URL, error name, stack, messages, GitHub status and snippet) | Members of the Cloudflare account with access to the Worker's logs |

Redaction runs before either store is written. It is pattern-based, so it lowers the risk but cannot promise that nothing personal ever slips through (a name typed into a description, for example, is kept).

## Retention

> **TODO (maintainer decision):** retention period for report issues and Workers Logs is not decided yet. Record it here once confirmed. Until then, GitHub issues stay until closed or deleted by hand, and Workers Logs follow the account's default log retention.

## Consequences

- Patterns keep ordinary messages and stack frames (file and function names, line and column) readable. They still over-redact some things, which is the trade we accept: a credential word followed by `:` (`Cache key: foo`), and long digit runs such as 10-digit epoch timestamps, which look like phone numbers. They miss a key name followed only by a space (`x-api-key abc`) and free text such as a name typed into a description.
- Every pattern starts only at a run boundary and bounds its backtracking, so redaction is linear in input length. It also reads at most four times a field's limit, so an oversized field costs bounded CPU however large the request body was. Rejecting oversized requests at the schema is separate work (#248).

Decided in https://github.com/rymanacevedo/SCC/issues/250.
