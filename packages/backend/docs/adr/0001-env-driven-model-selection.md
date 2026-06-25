# ADR-0001: Inject the language model into the generation seam; select it from the environment

- **Status:** Accepted — implementation pending
- **Date:** 2026-06-24
- **Context scope:** Backend (`packages/backend`)

## Context

The three section generators in `src/services/ai.ts` (`createSummaries`, `createSkills`, `createExperience`) each take `(prompt, apiKey)` and construct their model inline:

```ts
const openai = createOpenAI({ apiKey });
const model = openai('gpt-5-nano');
```

This hardcodes `gpt-5-nano` in three places and welds model construction inside the generation logic. Two needs exposed the friction:

1. **Evaluating model changes.** Before changing the production model we want to measure quality with evals (evalite). An eval must be able to *choose* the model and *wrap* it (e.g. `traceAISDKModel` for caching and per-call cost). With the model built inside each generator from an API key, the eval can supply inputs but not the model — comparing models would mean editing source in three places per experiment.
2. **Cost.** The project is run solo for a nonprofit. Running evals (and potentially production) against local or self-hosted OpenAI-compatible models (Ollama, LM Studio) avoids per-token cost. The generators should not care which provider produced the model.

## Decision

**1. The generation seam takes an injected `LanguageModel`.** The section generators become `createX(prompt, model)`. They no longer know about API keys, providers, or model ids. The model is provider-agnostic, so the same generator runs against OpenAI cloud, a self-hosted endpoint, or a local model unchanged.

**2. Production selects the model from the environment via a single model adapter.** A new `resolveModel(env)` in `src/services/model.ts` is the only place that names a concrete provider or model id. It reads:
   - `OPENAI_API_KEY` (required),
   - `OPENAI_BASE_URL` (optional — omit for OpenAI cloud, set for a self-hosted/local OpenAI-compatible endpoint),
   - `OPENAI_MODEL` (optional — omit to fall back to `DEFAULT_MODEL = 'gpt-5-nano'`, kept in `model.ts`).

   Environment validation stays in the Hono routes (`validateOpenAiEnvironment`); `resolveModel` is a pure `config → LanguageModel` function with no error-handling surface. The default model id lives in `model.ts`, not in the zod schema, so the schema keeps mirroring raw environment truth.

**3. The Hono routes are the production adapter.** A single `aiRoute(generate)` factory validates the environment, calls `resolveModel`, reads the validated prompt, and invokes the generator. `zValidator` stays on each route so invalid input still returns 400. Evals compose the model themselves (or reuse `resolveModel`) and pass it in.

## Consequences

**Positive**
- Model selection is one change point. Swapping the production model becomes a `wrangler` env change (`OPENAI_MODEL`), not a code deploy.
- The generation seam becomes the eval/test surface: an eval passes `traceAISDKModel(resolveModel({ … }))`; a unit test passes a `MockLanguageModelV3` (from `ai/test`) and exercises generation offline for $0.
- Local / self-hosted models work with no new dependency — `createOpenAI({ baseURL })` already speaks to any OpenAI-compatible endpoint.
- Provider construction stops being duplicated across three generators; the dead `if (!apiKey)` guard in each route is removed.

**Negative / costs**
- Two new optional environment variables to document and configure.
- Keyless local servers still require a placeholder `OPENAI_API_KEY`; the key stays unconditionally required to avoid conditional-schema complexity.
- A bad `OPENAI_MODEL` now fails at request time rather than being impossible by construction. Mitigated by env validation and the `DEFAULT_MODEL` fallback.
- The experience route's error body changes from `Failed to generate content: ${error}` to the bare `Failed to generate content` (the factory normalizes all three). This is intentional — it removes a minor info-leak; the detail moves to a server-side `console.error`.

## Alternatives considered

- **Keep `resolveModel` OpenAI-cloud-only; let only evals build alternate/local models.** Simpler, but production model swaps would need code changes, and self-hosting later would mean reopening this. Rejected in favor of env-driven selection now.
- **Inject a config object (`{ apiKey, modelId }`) or a factory instead of a `LanguageModel`.** Both keep model construction inside the generator — exactly what blocks an eval from wrapping the model. Rejected; the point is that the *caller* owns model construction.
- **Options-object signature `createX({ prompt, model })` to match `github.ts` house style.** Rejected for two args of distinct types in an obvious order — it adds ceremony without removing transposition risk, and churns the eval call sites.

## Do not re-suggest

Re-hardcoding `openai('gpt-5-nano')` inside the section generators "for simplicity." It re-welds the model into generation and breaks model-comparison evals. The model is injected at the seam by design.
