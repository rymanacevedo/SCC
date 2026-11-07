---
status: accepted
date: 2026-11-07
---

# Reports store structure only: free text is never kept

Error telemetry (`/api/errors`) and User reports (`/api/report-issue`) used to reach GitHub issues and Workers Logs as sent: full `location.href` with query string and fragment, raw messages, raw stacks, raw upstream response snippets. A resume builder's errors and descriptions can easily carry an email address, a phone number, a name or a token.

Two designs came first. A denylist masked known-sensitive patterns and kept everything else; review found a new shape it missed in each of five rounds. A token allowlist then kept only safe-looking words, plus one rule that redacted the value after a credential word; review found a new credential phrasing in each of four more rounds (run-together names, joined values, plurals, symbol-only passwords). Free text has no shape that can be proven safe, so any rule over it leaks the phrasing nobody thought of.

We decided that **reports never store free text**. Only structural fields survive, each fail-closed; every free-text field is replaced by a placeholder that shows only its length. One shared module does it (`shared/telemetryRedaction.ts` for URLs, names and placeholders, `shared/stackFrames.ts` for stack traces), applied per field by `sanitizeErrorTelemetry` and `sanitizeUserIssueReport` in `shared/errorReporting.ts`.

What a stored report holds:

- **Error telemetry**
  - `timestamp`: canonical ISO (`toISOString()`), or the epoch if it does not parse.
  - `url`: origin + path, no userinfo, query or fragment, and only plain path segments: split at `-_.~+`, every part a word, a number of up to 4 digits or an API version (`api`, `v1`, `users`, `me`, `1234`), and only a file name with an extension may also hold a content hash (`index-C4kL9x.js`). A segment has at most 4 digits in total, however separated, and at most 64 characters; any other segment becomes `[redacted]`. An origin that is not http(s), or whose host holds 5+ digits (`127.0.0.1`), becomes `https://redacted.invalid`, so the URL always passes its schema.
  - `message`: `[message omitted: N characters]`.
  - `stackTrace`: the error name, then canonical frames. The first line, `Name: message`, is reduced to the name if it is an error class name (`TypeError`, `ChunkLoadError`, `DOMException`: letters only, ending in `Error` or `Exception`), else `[redacted]`. Each V8 (`at fn (loc)`, `at loc`) or Firefox/Safari (`fn@loc`) frame is re-emitted as `    at <fn> (<file>:<line>:<col>)`: the function name must be an identifier shape (`saveSummary`, `Array.map`, `Object.<anonymous> [as run]`, one `new ` or `async ` prefix, at most 4 digits; else `<anonymous>`), the file follows the URL path rules, and line and column are digits. Any other line becomes `    [frame omitted]`.
- **User report**
  - `timestamp` and `url` as above.
  - `description`: `[description omitted: N characters]`.

Every other sink follows the same rule:

- The auto-reported issue title is `Auto-reported error: <name> at <path>`.
- The fingerprint, which deduplicates auto-reported issues, is the error name, the path and the top five frames, with asset hashes and stack coordinates normalized so a new build does not split it. The issue carries its SHA-256 digest; the legacy raw-JSON marker that deduplication also matches is computed from the same sanitized values.
- Workers Logs lines carry the error class name, canonical frames, the cause's class name, the message length, status codes, path-only URLs and short machine tokens (`github`, `maxRetriesExceeded`).
- A GitHub error body is never read, only cancelled: the status says enough.

Every field fits its schema limit (`REPORT_FIELD_LIMITS`); a stack is cut at a frame boundary with a visible `… [truncated]` marker that fits inside the limit. Input past four times a field's limit is never read, and a frame cut in half by that bound is dropped.

The browser's callers sanitize once before sending (`reportErrorTelemetry`, the Report an issue dialog, the storage telemetry), so free text never crosses the wire. `app/api.ts` accepts only the branded `SanitizedErrorTelemetry` and `SanitizedUserIssueReport` types, so a raw payload is a compile error. The Worker sanitizes again before building an issue, a fingerprint or a log line, because it never trusts the client, and uses one sanitized value for the dedup lookup, the title and the body. Issue bodies render the sanitized values as code (`fencedBlock`, `inlineCode`).

## Where reports are stored and who can read them

| Store | What lands there | Who can read it |
|-------|------------------|-----------------|
| GitHub issues in this repository (`GITHUB_REPO`), labelled `auto-reported` or `user-reported` | One issue per Error telemetry fingerprint (deduped against open issues) and one per User report | Anyone who can read the repository's issues, plus the holder of the Worker's `GITHUB_TOKEN` |
| Workers Logs for this Worker | One `console.error` line per failed report route (route, category, timestamp, path-only URL, error and cause class names, canonical frames, message length, status codes) | Members of the Cloudflare account with access to the Worker's logs |

Sanitizing runs before either store is written.

## Retention

> **TODO (maintainer decision):** retention period for report issues and Workers Logs is not decided yet. Record it here once confirmed. Until then, GitHub issues stay until closed or deleted by hand, and Workers Logs follow the account's default log retention.

## Consequences

- Reports carry much less detail. No message, description or upstream response text is ever stored, so a maintainer learns which error happened, where, and through which frames, but not what the user wrote or what the error said. Reproducing the error, or asking the user, replaces reading it from the report. A User report says only that a report was filed, from which page, and how long it was.
- The credential-rule risks of the earlier designs go away: there is no free text left for a credential phrasing to hide in.
- The remaining residual risk is small and structural: a path segment or frame file can still be personal if it is a plain word (`/home/janedoe/…` in a dev stack, `/u/janedoe` in a URL), and a random token passes as a content hash if it is followed by a file extension (`/XkfQpLmZr9Ab.js`). A segment with 5+ digits is redacted even when harmless (a build number, `chunk-8f3a91c2d7.js`, a checkout directory such as `agent-a2bb3e3e3a9bcce42`).
- The fingerprint is now the error name, path and top frames, computed on sanitized values. An open issue filed under an earlier fingerprint does not match a new report of the same error: each such pre-existing issue may get one duplicate. Reports that differ only below the top five frames dedupe together.
- Rejecting oversized requests at the schema is separate work (#248).

Decided in https://github.com/rymanacevedo/SCC/issues/250.
