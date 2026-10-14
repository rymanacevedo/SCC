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

## Generation architecture

### Generation seam
The boundary where a serialized section input becomes AI content: the three section generators. It is the surface evals and unit tests drive — a generator called in isolation, with no HTTP and no environment, fully exercises generation. Each generator takes `(prompt, model)` — the injected `LanguageModel` is the seam's second half (see [ADR-0001](docs/adr/0001-env-driven-model-selection.md), implemented).

### Model adapter (`resolveModel`)
The single place that turns validated environment config into a concrete `LanguageModel` — the only module that may name a concrete provider or model id. The section generators never do. It reads `OPENAI_API_KEY`, optional `OPENAI_BASE_URL` (omit → OpenAI cloud; set → a self-hosted or local OpenAI-compatible endpoint such as Ollama/LM Studio), and optional `OPENAI_MODEL` (omit → `DEFAULT_MODEL`). The API routes compose it per-request from validated environment; evals compose it (or any `LanguageModel`) themselves and wrap it for tracing/caching.

Introduced by [ADR-0001](docs/adr/0001-env-driven-model-selection.md) — **accepted and implemented.**

## Quality measurement

Test, Component test, Controller test, Contract test, Flow test, Eval, and Bake-off are system-wide terms; they live in the root [`GLOSSARY.md`](../GLOSSARY.md). The generation seam is the surface Tests and Evals drive.
