---
status: accepted
date: 2026-11-07
---

# Reports are sanitized fail-closed before storage, on both sides

Error telemetry (`/api/errors`) and User reports (`/api/report-issue`) used to reach GitHub issues and Workers Logs as sent: full `location.href` with query string and fragment, raw messages, raw stacks, raw upstream response snippets. A resume builder's errors and free-text descriptions can easily carry an email address, a phone number, or a token.

A first design masked known-sensitive patterns (a denylist) and kept everything else. Five review rounds each found a new shape it missed: userinfo, long quoted values, lowercase auth schemes, cookie lists, colon-adjacent phone numbers, parens in URL paths, several URLs in one JSON run. A denylist fails open: every shape nobody thought of survives.

We decided that every report is **sanitized fail-closed before it is stored**: only shapes known to be safe survive, and everything else becomes `[redacted]`. One shared module does it (`shared/telemetryRedaction.ts` for URLs and free text, `shared/stackFrames.ts` for stack traces), applied per field by `sanitizeErrorTelemetry` and `sanitizeUserIssueReport` in `shared/errorReporting.ts`:

- **URLs** (a report's `url`, a frame's file, a URL inside text) must parse as http(s). They are emitted as origin + path, with no userinfo, query or fragment, and only plain path segments, judged by the same token rules as free text: split at `-_.~+`, every part must be a word, a number of up to 4 digits or an API version (`api`, `v1`, `users`, `me`, `1234`), and only a file name with an extension may also hold a content hash (`index-C4kL9x.js`). A segment has at most 4 digits in total, however separated (so `555-123-4567` and `555.123.4567` go), at most 64 characters, and may carry `@scope`, `(group)` or `[slug]`. A random-looking segment such as `/reset/XkfQpLmZr9Ab` becomes `[redacted]`, like any other segment that fails. Anything that is not an http(s) URL, or whose host holds 5+ digits, becomes `[redacted]` whole.
- **Stack traces** are parsed line by line as V8 (`at fn (loc)`, `at loc`) or Firefox/Safari (`fn@loc`) frames. Each is re-emitted as `    at <fn> (<file>:<line>:<col>)`: the function name must be an identifier shape (`saveSummary`, `Array.map`, `Object.<anonymous> [as run]`, with one `new ` or `async ` prefix, at most 4 digits; else `<anonymous>`), and line and column are digits. A line that is not a frame becomes `    [frame omitted]`, with consecutive ones collapsed. The first line, `Name: message`, goes whole through free-text sanitizing, so a known error name (`TypeError`) survives as a word and a credential name (`apiKey: x`, `TokenError: x`) keeps its context for the value.
- **Free text** (messages, descriptions, the GitHub response snippet, logged error text) is split on whitespace, and only safe tokens survive:
  - words of letters (any script) up to 24 characters, with inner apostrophes or hyphens;
  - numbers of up to 4 digits, unless next to another token with a digit (`555 123 4567`);
  - code identifiers of letters, `_`, `$` and `.` (`foo_bar`, `x.y`, `getElementById()`) up to 40 characters;
  - short ordinary punctuation (up to 4 of `.,;:!?()[]{}<>'"` and backtick, `-`, `–`, `—`, `…`, `/`) or a run of one repeated mark (`##`, three backticks, `---`), and any of the shapes above wrapped in or followed by it. A mixed symbol run such as `!@#$%^&*()` can be a password, so it is redacted;
  - http(s) URLs, emitted path-only. Once a URL has a query or fragment, nothing after `?` or `#` comes back, except the closers of wrappers opened before the URL (and one `.,;:` after them): `https://x/a?token=?!` loses `?!`, `(https://x/a?q=1).` keeps `).`.

  Every other token becomes `[redacted]`, and consecutive ones collapse. That alone blocks emails (`@`), phone numbers and ids (digit runs), API keys and JWTs (mixed letters and digits, or length), and `key=value` pairs (`=`). One context rule remains: the value after a credential name is always redacted. A name is a credential name if any of its words is a credential word (`password`, `secret`, `token`, `key`, `auth`, `authorization`, `bearer`, `basic`, `cookie`, `session`, `otp`, `pin`, `passcode`, `passphrase`, …), however it is written: `accessToken`, `clientSecret`, `config.password`, `x-api-key`, `AUTH_TOKEN`, and `name=` or `name:` forms. A joined name with an empty value (`password=`, `token:=`) leaves the value for the next token. Only a separator token (`:`, `=`, `:=`, `->`, `=>`, a dash) or a lone opening quote keeps the context alive; the first token after that goes whatever its shape, punctuation included, and a quoted value goes through its closing quote. So a letters-only password such as `Password hunter` and a symbol-only one such as `password: !@#$%^&*()` are both caught.
- **Timestamps** are re-emitted as canonical `toISOString()`, or `[redacted]` if they do not parse.
- Every field is then cut to its schema limit, the visible `… [truncated]` marker included, so a sanitized report always passes the Worker's schema. The limits are the one field map the schemas enforce (`REPORT_FIELD_LIMITS`: URL 2,048, message 1,000, stack 16,000, description 10,000 code units); a logged stack is capped at 4,000 and cut at a frame boundary. Cuts never split a surrogate pair (`truncateText`). Input past four times a field's limit is never read, and a token or frame cut in half by a bound is dropped. Every pass is linear in its input.

The browser's callers sanitize once before sending (`reportErrorTelemetry`, the Report an issue dialog, the storage telemetry), so the data never crosses the wire. `app/api.ts` accepts only the branded `SanitizedErrorTelemetry` and `SanitizedUserIssueReport` types, so a raw payload is a compile error. The Worker sanitizes again before building an issue body, a fingerprint, or a log line, because it never trusts the client. It sanitizes Error telemetry once per request and uses that one value for the dedup lookup, the title and the body, so the fingerprint written into an issue always matches the one looked up. The issue fingerprint is the SHA-256 digest of the fingerprint JSON of the sanitized values, so dedup is not split by query strings or by redacted personal data. The legacy raw-JSON marker that deduplication also matches is computed from the same sanitized values, so no raw report text is ever compared with or sent to GitHub. Issue bodies render the sanitized values as code (`fencedBlock`, `inlineCode`): fencing comes after sanitizing, so it only has to contain text that is already safe.

## Where reports are stored and who can read them

| Store | What lands there | Who can read it |
|-------|------------------|-----------------|
| GitHub issues in this repository (`GITHUB_REPO`), labelled `auto-reported` or `user-reported` | One issue per Error telemetry fingerprint (deduped against open issues) and one per User report | Anyone who can read the repository's issues, plus the holder of the Worker's `GITHUB_TOKEN` |
| Workers Logs for this Worker | One `console.error` line per failed report route (route, category, timestamp, path-only URL, error name, stack, messages, GitHub status and snippet) | Members of the Cloudflare account with access to the Worker's logs |

Redaction runs before either store is written. It is pattern-based, so it lowers the risk but cannot promise that nothing personal ever slips through (a name typed into a description, for example, is kept).

## Retention

> **TODO (maintainer decision):** retention period for report issues and Workers Logs is not decided yet. Record it here once confirmed. Until then, GitHub issues stay until closed or deleted by hand, and Workers Logs follow the account's default log retention.

## Consequences

- Reports carry less detail. A path segment that is not a word, short number, version or hashed file name is redacted even when it is harmless (a slug such as `/p/a1b2c3`, a mixed-case id), and so is one with 5+ digits: a content hash such as `chunk-8f3a91c2d7.js`, a build number, or a checkout directory such as `agent-a2bb3e3e3a9bcce42` in a dev stack. The token after a credential name goes even in error text, and any name with a credential word counts (`hotKey press` loses `press`) (`Unexpected token '<'` becomes `Unexpected token [redacted]`). Dates, times, ids, version strings (`v1.2.3`), long numbers, `key=value` text, compact JSON, file paths outside a frame, and stack lines that are not frames all arrive as `[redacted]` or `[frame omitted]`. The word after a credential word goes too, even in prose (`the token [redacted]`, `Basic [redacted] is required`). That is the price of failing closed. A maintainer who needs the detail reproduces the error rather than reading it from the report.
- Residual risks, which an allowlist cannot close:
  - personal data made only of letters survives: a name, a street or a company typed into a description (`my name is Jane Doe`), or a letters-only secret that does not follow a credential word;
  - a multi-word secret after a credential word keeps every word but the first unless it is quoted (`password correct horse battery staple`);
  - a plain path segment can still be personal (`/home/janedoe/…` in a dev stack, `/u/janedoe` in a URL), and a random token passes as a content hash if it is followed by a file extension (`/XkfQpLmZr9Ab.js`).
- The fingerprint is now computed on sanitized values with canonical frames, so an open issue filed from unsanitized values (by the digest or the legacy raw-JSON marker) does not match a new report of the same error: each such pre-existing issue may get one duplicate.
- Rejecting oversized requests at the schema is separate work (#248).

Decided in https://github.com/rymanacevedo/SCC/issues/250.
