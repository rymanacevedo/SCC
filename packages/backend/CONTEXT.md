# Backend — Context Glossary

The backend is a Cloudflare Workers service (Hono) that turns a user's answers to a resume **section** into AI-generated content, and reports issues to GitHub. Use these terms exactly; prefer them over generic synonyms ("service", "handler", "AI client", "boundary").

## Resume domain

### Section
One step of the resume builder — e.g. Summary, Skills, Experience. The user answers simple questions for a section; the backend generates content for that section. "One section at a time" is the app's whole shape (see the root `AGENTS.md`).

### Section generator
A function that maps one section's input to AI-generated content. There are three, in `src/services/ai.ts`: `createSummaries`, `createSkills`, `createExperience`. Each takes the user's `prompt` (their section answers, already serialized to the `<job>…</job>` string the frontend builds) and returns structured output validated by a Zod schema. Each generator's prompt — system text, few-shot examples, the Blacklist — is co-located with it.

### Blacklist
A safety constant in `src/services/ai.ts` listing roles the generators must not write resume content for; on a match the generator returns general advice instead. Interpolated into every section generator's system prompt. Safety-critical — editing it changes what the product will and won't produce.

## Generation architecture

### Generation seam
The boundary where a serialized section input becomes AI content: the three section generators. It is the surface evals and unit tests drive — a generator called in isolation, with no HTTP and no environment, fully exercises generation. Each generator takes `(prompt, model)` — the injected `LanguageModel` is the seam's second half (see [ADR-0001](docs/adr/0001-env-driven-model-selection.md), implemented).

### Model adapter (`resolveModel`)
The single place that turns validated environment config into a concrete `LanguageModel` — the only module that may name a concrete provider or model id. The section generators never do. It reads `OPENAI_API_KEY`, optional `OPENAI_BASE_URL` (omit → OpenAI cloud; set → a self-hosted or local OpenAI-compatible endpoint such as Ollama/LM Studio), and optional `OPENAI_MODEL` (omit → `DEFAULT_MODEL`). The Hono routes compose it per-request from `c.env`; evals compose it (or any `LanguageModel`) themselves and wrap it for tracing/caching.

Introduced by [ADR-0001](docs/adr/0001-env-driven-model-selection.md) — **accepted and implemented.**

## Quality measurement

### Test
A deterministic check of *code* behavior. Runs under `bun test` (`*.test.ts`, co-located with source), drives the generation seam with a `MockLanguageModelV3` from `ai/test` — no network, no API key, $0. A failing test means the code is wrong.

### Eval
A measurement of *model/prompt output quality* — not pass/fail on code. Runs under evalite (`*.eval.ts` in `evals/`), calls real models through the generation seam, costs real tokens, and is judged by scorers plus human review in the evalite UI. A "failing" eval means a model or prompt performs worse, not that code is broken. Evals compose their own `LanguageModel`s (any provider, via the AI SDK) and never go through HTTP routes or `resolveModel`.

### Bake-off
A one-shot comparative eval across a fixed **roster** of candidate models over the same fixtures, run to make a model-selection decision. The verdict is human; if it changes the production model, that change is recorded as its own ADR and commit — a bake-off never mutates production configuration itself.
