# Worker — Context Glossary

The Worker is a Cloudflare Workers service  that turns a user's answers to a resume **section** into AI-generated content, and reports issues to GitHub. Use these terms exactly; prefer them over generic synonyms ("service", "handler", "AI client", "boundary").

## Resume domain

### Section
One step of the resume builder — e.g. Summary, Skills, Experience. The user answers simple questions for a section; the Worker generates content for that section. "One section at a time" is the app's whole shape (see the root `AGENTS.md`).

### Section generator
A function that maps one section's input to AI-generated content. There are three, in `services/ai.ts`: `createSummaries`, `createSkills`, `createExperience`. Each takes the user's `prompt` (their section answers, already serialized to the `<job>…</job>` string the frontend builds) and returns structured output validated by a Zod schema. Each generator's prompt — system text, few-shot examples, the Blacklist — is co-located with it. Its output schema is the API contract: it lives in the shared context and is the one declaration both the generator and the API client use.

### Blacklist
A safety constant in `services/ai.ts` listing roles the generators must not write resume content for; on a match the generator returns general advice instead. Interpolated into every section generator's system prompt. Safety-critical — editing it changes what the product will and won't produce. Steers the model's *output*; refusing *input* is the Profanity filter's job.

### Profanity filter
A guard on the three generation routes that refuses a Generation request whose prompt contains a disallowed word or role, before any model is called. Refuses input; the Blacklist, by contrast, steers output. One copy, on the Worker, so every caller is covered; a refusal names the matched term in the Error envelope.

## API surface

### Generation request
The body a builder page sends to a generation route: `{ prompt }` with a non-empty string prompt, the section answers already serialized by the frontend. The Worker never sees the User, only the prompt.

### Error envelope
The one shape every non-2xx `/api/*` response carries: `{ error }`, plus `issues` on every 400: Zod 4 `flattenError` output, `{ formErrors, fieldErrors }` (validation details, or both empty for a filtered prompt). The status code is the discriminator; the `error` text is for logs and tests, never shown to the user verbatim.

### Same-origin guard
The middleware that replaces CORS now that UI and API share one origin: rejects requests marked `Sec-Fetch-Site: cross-site` with 403 and bodies without the `application/json` content type with 415. Absent fetch-site metadata is accepted, including command-line callers. No configuration, no allowed-origin variable.

### Body limit
The 1 MiB cap on any `/api/*` JSON body (`MAX_JSON_BODY_BYTES`). The Worker reads at most that many bytes and cancels the rest, so a body never has to fit in memory whole. A larger body gets a 413 Error envelope before validation or any model call.

### Client cancellation
A request whose client disconnected before the response. `request.signal` aborts, the generation route passes that signal to the provider so the call stops, and the Worker entry logs it once as `client_aborted` with a 499. It is not a route failure: the router rethrows the abort reason once the signal fires, and the route error middleware rethrows it rather than log it.

## Reporting

### Error telemetry
The automatic report the app sends to `/api/errors` when a page throws: timestamp, URL, message and optional stack. The Worker turns it into an `auto-reported` GitHub issue, deduped by its fingerprint against open issues.
_Avoid_: crash report, error log

### User report
The report a user writes in the Report an issue dialog, sent to `/api/report-issue`: description, timestamp and URL. The Worker turns it into a `user-reported` GitHub issue.
_Avoid_: feedback, ticket

### Report sanitizing
Keeping only the parts of a report known to be safe: URLs as http(s) origin + path, stack traces as canonical frames, free text as allowlisted tokens. Everything else becomes `[redacted]`, and each field is truncated with a `… [truncated]` marker. The browser's callers run it before sending; the Worker runs it again before any issue, fingerprint or log line (see [ADR-0002](docs/adr/0002-reports-are-redacted-before-storage.md)).
_Avoid_: scrubbing, anonymizing

## Generation architecture

### Generation seam
The boundary where a serialized section input becomes AI content: the three section generators. It is the surface evals and unit tests drive — a generator called in isolation, with no HTTP and no environment, fully exercises generation. Each generator takes `(prompt, model, abortSignal?)` — the injected `LanguageModel` is the seam's second half; the API routes pass the request's signal so a client disconnect cancels the provider call (see [ADR-0001](docs/adr/0001-env-driven-model-selection.md), implemented).

### Model adapter (`resolveModel`)
The single place that turns validated environment config into a concrete `LanguageModel` — the only module that may name a concrete provider or model id. The section generators never do. It reads `OPENAI_API_KEY`, optional `OPENAI_BASE_URL` (omit → OpenAI cloud; set → a self-hosted or local OpenAI-compatible endpoint such as Ollama/LM Studio), and optional `OPENAI_MODEL` (omit → `DEFAULT_MODEL`). The API router composes it once, on the first generation request, from validated environment and reuses it for that env; evals compose it (or any `LanguageModel`) themselves and wrap it for tracing/caching.

Introduced by [ADR-0001](docs/adr/0001-env-driven-model-selection.md) — **accepted and implemented.**

## Quality measurement

Test, Component test, Controller test, Contract test, Flow test, Eval, and Bake-off are system-wide terms; they live in the root [`GLOSSARY.md`](../GLOSSARY.md). The generation seam is the surface Tests and Evals drive.
