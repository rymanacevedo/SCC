---
status: accepted
date: 2026-11-07
---

# ADR-0001: Reports store structure only: free text is never kept

Error telemetry (`/api/errors`) and User reports (`/api/report-issue`) used to reach GitHub issues and Workers Logs as sent: full `location.href` with query string and fragment, raw messages, raw stacks, raw upstream response snippets. A resume builder's errors and a user's typed description can easily carry an email address, a phone number, a name or a token.

Two designs came first. A denylist masked known-sensitive patterns and kept everything else; review found a new shape it missed in each of five rounds. A token allowlist then kept only safe-looking words, plus one rule that redacted the value after a credential word; review found a new credential phrasing in each of four more rounds (run-together names, joined values, plurals, symbol-only passwords). Free text has no shape that can be proven safe, so any rule over it leaks the phrasing nobody thought of.

We decided that **reports never store free text**. Only structural fields survive, each fail-closed. The User report no longer asks for a description at all; the error message, the only free text left, is replaced by a placeholder that shows only its length. One shared module does it (`shared/telemetryRedaction.ts` for URLs, names and placeholders, `shared/stackFrames.ts` for stack traces), applied per field by `sanitizeErrorTelemetry` and `sanitizeUserIssueReport` in `shared/errorReporting.ts`.

What a stored report holds:

- **Error telemetry**
  - `timestamp`: canonical ISO (`toISOString()`), or the epoch if it does not parse.
  - `url`: the path alone, under one synthetic origin, `https://app.invalid`: no real host (a hostname can name a person or a private network), userinfo, query or fragment, and only plain path segments. A segment is split at `-_.~+`, and every part passes the one identifier rule that stack-frame function names also use (`isSafeIdentifierPart`): at most 4 digits, no key shape, and every word (split at `_`, `$`, `-`) a written word, a number of up to 4 digits or an API version (`api`, `v1`, `users`, `me`, `1234`). A written word fails if it looks random: 8+ letters more than 40% upper-case (`XkfQpLmZrAb`; `UserProfile` and `XMLHttpRequest` pass), or more than 12 capitals (`AKIA…`; `README` passes); a word mixing letters and digits (`hunter2`) fails too. Only a file name with an extension may also hold a content hash (`index-C4kL9x.js`). The segment is judged whole as well: at most 4 digits in total, however separated, at most 64 characters, and no key shape anywhere, in any case (a short prefix, an optional short tag, then 16+ letters or digits: `sk_live_…`, `pk_test_…`, `ghp_…`, `xoxb-…`, bounded by anything not a letter or digit, so `(sk_live_…)`, `@sk_live_…` and `sk_live_….js` count; `isSensitiveToken`). Any segment that fails becomes `[redacted]`. A URL that is not http(s) is the synthetic origin alone. The URL always passes its schema.
  - `message`: `[message omitted: N characters]`.
  - `stackTrace`: the error name, then canonical frames. The first line, `Name: message`, is reduced to the name if it is on a fixed list of known error classes (one constant, `KNOWN_ERROR_NAMES`: JavaScript's built-ins, the browser's `DOMException` names, `ChunkLoadError`, and every class the Worker defines or reports, such as `GitHubIssueCreationError` and `AI_APICallError`), else `Error`. A shape rule (`…Error`) would let `Token_sk_live_…Error` through, so there is none. Firefox and Safari stacks have no header, so the browser puts the error's class name first (`stackWithHeader`), and the title and fingerprint read the name the same way whatever the browser. The first line is read as a header before it is tried as a frame, so `Error: …@host:1:2` is not taken for a Firefox frame. Each V8 (`at fn (loc)`, `at loc`) or Firefox/Safari (`fn@loc`) frame is re-emitted as `    at <fn> (<file>:<line>:<col>)`: the function name must be an identifier shape (`renderSummary`, `Array.map`, `Object.<anonymous> [as run]`, one `new ` or `async ` prefix), and every dotted part and alias must pass the identifier rule path segments use (`isSafeIdentifierPart`); else `<anonymous>`. The file keeps only an allowlisted scheme: a plain path; `http(s)` under the synthetic origin; `blob:` around such a URL; `node:`; or `webpack:`, `webpack-internal:`, `file:`, `chrome-extension:`, `moz-extension:` or `safari-extension:` with any host replaced by the synthetic one. A nested URL never keeps its host, not even as a path segment (`blob:https://janedoe.example.com/x.js` becomes `blob:https://app.invalid/x.js`). Any other scheme omits the frame, since dropping only the scheme would leave what followed it to be read as a path. Line and column are digits. Any other line becomes `    [frame omitted]`.
- **User report**: a page path and the time, `timestamp` and `url` as above. The Report an issue dialog has no text box; it says it will send the page and the time, and that is all it sends. An older client may still send a `description`: the schema strips unknown keys, so it is accepted and dropped before any sink, rather than refused, which would lose a report the server can use. (A description long enough to push the body over the route's body limit, now derived from the two remaining fields, is refused with a 413 instead.)

Every other sink follows the same rule:

- The auto-reported issue title is `Auto-reported error: <name> at <path>`.
- The fingerprint, which deduplicates auto-reported issues, is the error name, the path and the top five frames, with asset hashes and stack coordinates normalized so a new build does not split it. The issue carries its SHA-256 digest, and deduplication matches only that digest. An error with no stack sends its class name in place of one, so it still reaches the fingerprint and the title.
- Workers Logs lines carry the known error class name (`Error` for any other), canonical frames, the cause's known class name, the message length, status codes, path-only URLs and short machine tokens (`github`, `maxRetriesExceeded`). A thrown value that is not an Error is logged by its type alone; it is never stringified, since `String(value)` can throw.
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

Decided by the maintainer: retention is whatever the Cloudflare free plan provides.

- **Workers Logs** keep report log lines for the Workers Free plan default (3 days, 7 days from 2026-12-01). Today Workers Logs retention is set by [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/#workers-logs); from 2026-12-01 Workers Logs moves to [Cloudflare Observability pricing](https://developers.cloudflare.com/observability/pricing/), whose Free plan includes 7-day retention (both checked 2026-11-07). This repo does not override it: no extra retention configuration and no Logpush.
- **GitHub issues** (`auto-reported` and `user-reported`) are not governed by a Cloudflare plan. They are kept until a maintainer closes or deletes them; nothing expires them automatically. That is acceptable because a report holds no free text: a path-only URL on the synthetic origin, canonical stack frames, error class names and a message length.

## Consequences

- Reports carry much less detail. No message or upstream response text is ever stored, and the user is not asked to write anything, so a maintainer learns which error happened, where, and through which frames, but not what the error said or what the user saw. Reproducing the error, or asking the user, replaces reading it from the report. A User report is a signal: someone on this page, at this time, had a problem.
- The credential-rule risks of the earlier designs go away: there is no free text left for a credential phrasing to hide in.
- Identifier-shaped fields fail closed, so some real names are lost: an error class not on the list (a library's own error type) is reported as `Error`, and two such classes on the same path share a fingerprint; a function name with a word mixing letters and digits (`base64Encode`, `sha256`) or a random-looking part becomes `<anonymous>`; and a frame whose file has an unlisted scheme (including a Windows drive path, `C:\\…`) becomes `[frame omitted]`.
- The remaining residual risk is small and structural, and accepted: a plain-word path segment or frame file can still be personal (`/home/janedoe/…` in a dev stack, `/u/janedoe` in a URL), a lower-case random word passes as a word (`/reset/xkfqplmzrab`), and a random token passes as a content hash if it is followed by a file extension (`/XkfQpLmZr9Ab.js`). Hostnames are no longer a risk: no real origin is kept, so a report no longer tells which deployment or third-party script host it came from. A segment with 5+ digits, or that looks random or key-shaped, is redacted even when harmless (a build number, `chunk-8f3a91c2d7.js`, a checkout directory such as `agent-a2bb3e3e3a9bcce42`).
- The fingerprint is now the error name, path and top frames, computed on sanitized values. An open issue filed under an earlier fingerprint does not match a new report of the same error, and matching it would mean keeping raw report text, so each such pre-existing issue may get one duplicate. Reports that differ only below the top five frames dedupe together, and so do failures with neither a stack nor an error class (a thrown string or object, a rejected `Response`, the storage telemetry) on the same path: they share one issue per path.
- Rejecting oversized requests at the schema is separate work (#248).

Decided in https://github.com/rymanacevedo/SCC/issues/250.
