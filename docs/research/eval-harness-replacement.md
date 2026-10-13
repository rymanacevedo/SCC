# Eval harness replacement after evalite

- **Ticket:** [#189](https://github.com/rymanacevedo/SCC/issues/189) (map [#174](https://github.com/rymanacevedo/SCC/issues/174); follows [#188](https://github.com/rymanacevedo/SCC/issues/188), feeds [#185](https://github.com/rymanacevedo/SCC/issues/185) and the bake-off [#163](https://github.com/rymanacevedo/SCC/issues/163) / [#165](https://github.com/rymanacevedo/SCC/issues/165)–[#170](https://github.com/rymanacevedo/SCC/issues/170))
- **Date:** 2026-10-12. Version numbers and dates below are as published on that day.
- **Question:** Which eval harness replaces evalite for measuring section-generator output quality, given the post-migration stack (AI SDK 7, Node 24 target, Bun runtime)?

## Summary

**Recommendation: a minimal in-repo runner under `bun test`, built on AI SDK 7's own primitives, writing JSON + Markdown reports. Add no eval framework.**

Why:

1. **Every hosted/framework candidate fails at least one hard constraint.** Promptfoo documents Node only (`>=22.22.0`) and bundles its own `ai ^6` copy; Braintrust, Langfuse and LangSmith all put the review surface behind an account (cloud free tiers with 14–30 day retention, or a four-service self-host stack); none of them runs the generation seam more directly than a ~150-line script does.
2. **AI SDK 7 already ships the three things evalite was providing.** `wrapLanguageModel` middleware (accepts V2/V3/V4 models) exposes per-call `usage` for token/cost capture; the `Telemetry` interface (`registerTelemetry`, `onStepEnd`/`onEnd`) is an in-process alternative; `ai/test` still exports `MockLanguageModelV3` and `MockLanguageModelV4` for the $0 unit tests. None of this pins `ai` — the runner uses whatever `ai` major the backend already depends on, so [#185](https://github.com/rymanacevedo/SCC/issues/185) can move to `ai` 7 with no eval-side constraint.
3. **The corpus is already harness-agnostic.** `evals/roster.ts`, `evals/fixtures/summaries.ts` and `evals/env.ts` survive the evalite removal unchanged; the runner is the only new file plus the scorers and cost map that [#167](https://github.com/rymanacevedo/SCC/issues/167)/[#168](https://github.com/rymanacevedo/SCC/issues/168) already call for as pure, `bun test`-covered modules.
4. **Lowest cost and maintenance.** Zero new dependencies, no account, no telemetry, no daemon. The human-review surface is a Markdown side-by-side table (fixture rows × roster columns, with scores and $/generation) that the maintainer reads and pastes into the [#170](https://github.com/rymanacevedo/SCC/issues/170) verdict comment. If a richer UI is ever wanted, the JSON report is the input to it; the scorer contract (`{ name, score, metadata }`) is deliberately the shape Braintrust's `autoevals` and Langfuse's evaluators use, so either can be bolted on later without rewriting scorers.

Trade-off accepted: no click-through UI. Promptfoo's `promptfoo view` is the strongest review surface in the field (manual pass/fail and 0–1 scores per cell, CSV/JSON export), but it costs a Node-only toolchain, 76 runtime dependencies and default-on telemetry for a bake-off of 3 models × ~45 fixtures that a Markdown table shows on one screen.

## Comparison table

| Candidate | Bun support | `ai` peer range | Scorers | Cost tracking | Review surface | Maintenance signal | Licence |
|---|---|---|---|---|---|---|---|
| **In-repo runner under `bun test`** (recommended) | Native (`bun test`, TS without build) | None — uses the backend's own `ai` (7.0.138 latest) | In-repo pure functions (Blacklist, structure, schema-satisfaction) | `wrapLanguageModel` middleware reads V4 `usage.inputTokens.total` / `outputTokens.total`; static pricing map | JSON + Markdown side-by-side report in `evals/results/` | Ours; AI SDK pushed 2026-10-13, Apache-2.0 | n/a (repo) |
| **Vercel AI SDK built-ins** (`Telemetry` interface, `@ai-sdk/otel`, middleware, `ai/test`) | Same as `ai` (ESM-only, Node ≥22); OTel path depends on Bun's partial `async_hooks` | `@ai-sdk/otel` 1.0.138 depends on `ai` **7.0.138 exactly** (lockstep); `Telemetry`/middleware are in `ai` itself | None — telemetry only | `onStepEnd`/`onEnd` events carry `usage`; OTel `gen_ai.usage.*` attributes | None (needs an OTel backend) | Part of `vercel/ai`, 1,904 open issues, pushed daily | Apache-2.0 |
| **Braintrust `autoevals` 0.4.0** (+ `braintrust` 3.37.2 runner) | Not documented for autoevals; `bt eval --runner bun` is documented | None (`zod ^3.25 \|\| ^4` peer; depends on `openai ^6.7.0`, not `ai`) | `ExactMatch`, `Levenshtein`, `ValidJSON` (schema), `JSONDiff`, `NumericDiff`, `ListContains`; LLM judges default to `gpt-5-mini` | None in autoevals; Braintrust UI only | Braintrust app (Starter: $0, 1 GB, **14-day retention**); `--no-send-logs` builds a "local summary" only | autoevals pushed 2026-10-08, 45 open issues; SDK pushed 2026-10-13, 89 open issues | autoevals MIT; `braintrust` npm says MIT, repo LICENSE is Apache-2.0 |
| **Promptfoo 0.124.1** | **Node only** (`engines.node >=22.22.0`; docs: "Promptfoo loads TypeScript providers in Node.js") | No peer; **depends on `ai ^6.0.286`** (nested second copy) | 40+ deterministic assertions incl. `is-json`, `regex`, `javascript` (`file://`), `cost`, `latency` | `cost`/`tokenUsage` from custom provider response; `cost` assertion; `getModelPricing` | `promptfoo view` web UI (manual pass/fail, 0–1 score, CSV/JSON/HTML export); `-o` to json/csv/html | Pushed 2026-10-13, **709 open issues**, 25.9k stars; 76 deps; telemetry on by default | MIT |
| **Langfuse `@langfuse/client` 5.13.1** | Not documented (`@langfuse/tracing` engines `node >=20`); OTel-based | None (`@opentelemetry/api ^1.9.0` peer) | In-process evaluators `{name, value, comment}`; `createEvaluatorFromAutoevals` | On the server (not verified here) | Langfuse UI: Cloud Hobby $0 (50k units/mo, 2 users, 30 days) or self-host **Postgres + ClickHouse + Redis + S3** | langfuse-js pushed 2026-10-12, 57 open issues; server 1,037 open issues | SDK MIT; server MIT + `ee/` |
| **LangSmith `langsmith` 0.10.12** | Not documented | None (optional OTel/`openai`/`ws` peers) | Evaluator functions in `evaluate()` | On the server (not verified here) | LangSmith UI: Developer $0 (5k traces/mo, 1 seat, 14-day base retention); self-host **Enterprise only** | Pushed 2026-10-13 | SDK MIT; server proprietary |
| *evalite (removed, for the record)* | Vitest-based | `1.0.0-beta.16`: **`ai ^6`**; `0.19.0` (latest tag): none | Built-in + autoevals | `wrapAISDKModel` tracing | Local web UI | **Last push 2026-04-28; last npm publish 2026-02-20; issue #400 "Support for AI SDK v7" open since 2026-06-29** | MIT |

## Constraints the harness must meet (from the repo)

- Drive the generation seam directly: `createSummaries(prompt, model)` etc. take an injected `LanguageModel`; evals "compose their own `LanguageModel`s … and never go through HTTP routes or `resolveModel`" ([GLOSSARY: Generation seam, Eval](../../packages/backend/GLOSSARY.md); [ADR-0001](../../packages/backend/docs/adr/0001-env-driven-model-selection.md)).
- Reuse the surviving corpus: `packages/backend/evals/roster.ts` (three-model roster via `@ai-sdk/openai` + `@ai-sdk/google`), `evals/fixtures/summaries.ts`, `evals/env.ts` (parses `.dev.vars`), and their `bun test` unit tests. The evalite removal commit (`5fb7d69`, "chore(backend): remove evalite eval harness") deleted only `evalite.config.ts`, `evals/setup.ts`, `evals/summaries.eval.ts`, the two scripts and the two devDependencies.
- Deterministic scorers (Blacklist, structure, schema-satisfaction), per-call token/$ capture with a dated static pricing map, side-by-side human review — [#167](https://github.com/rymanacevedo/SCC/issues/167), [#168](https://github.com/rymanacevedo/SCC/issues/168), [#170](https://github.com/rymanacevedo/SCC/issues/170). Scorer and cost logic must be pure, unit-tested under `bun test`, "using no bun-only test APIs". Evals and tests must use disjoint file conventions (PRD [#163](https://github.com/rymanacevedo/SCC/issues/163) stories 18–19).
- Must not pin `ai` below the current major. `ai` latest is **7.0.138** (published 2026-10-12; `7.0.0` on 2026-06-25), licence Apache-2.0, `engines.node >=22`, peer only `zod ^3.25.76 || ^4.1.8` ([npm `ai`](https://registry.npmjs.org/ai)). `@ai-sdk/openai` 4.0.92 and `@ai-sdk/google` 4.0.94 have the same engines/peers ([npm](https://registry.npmjs.org/@ai-sdk/openai), [npm](https://registry.npmjs.org/@ai-sdk/google)). AI SDK 7 "requires Node.js 22 or later", is "tested on Node.js 22, 24, and 26", and "all AI SDK packages are now ESM-only" ([7.0 migration guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0)).
- Bun: the repo pins `packageManager: bun@1.2.2`; Bun latest on npm is 1.4.3 ([npm `bun`](https://registry.npmjs.org/bun)).

## Candidates

### 1. Minimal in-repo runner under `bun test` (recommended)

**What it is.** One `evals/<section>.eval.ts` per section, executed by `bun test`, that loops `modelRoster × fixtures`, calls the generator through a usage-capturing wrapped model, runs the in-repo scorers, and in `afterAll` writes `evals/results/<timestamp>.json` plus a Markdown report. No framework.

**Bun facts (primary: Bun docs).**
- `bun test` discovers `*.test.*`, `*_test.*`, `*.spec.*`, `*_spec.*` only ([discovery](https://bun.com/docs/test/discovery)). `*.eval.ts` is therefore never collected by the unit-test run, which keeps the PRD's disjoint-glob requirement for free.
- "To run a specific file in the test runner, make sure the path starts with `./` or `/` to distinguish it from a filter name" ([CLI](https://bun.com/docs/cli/test)). The docs' example is a `*.test.ts` file; whether an explicit `./evals/summaries.eval.ts` path that does *not* match the default patterns is executed is **not stated** — see Open questions. The fallback is a plain `bun evals/run.ts` script with identical internals.
- `--timeout` is "a per-test timeout in milliseconds", default 5000; `--preload ./setup.ts` runs a file before tests; `-t/--test-name-pattern` filters by name; "`bun test` runs TypeScript tests without checking their types" ([CLI](https://bun.com/docs/cli/test)). `bunfig.toml [test]` supports `root`, `preload`, `pathIgnorePatterns`, and a `reporter.junit` path ([bunfig](https://bun.com/docs/runtime/bunfig)).
- Reporters: default console, `--reporter=dots`, `--reporter=junit --reporter-outfile=…`, automatic GitHub Actions annotations. No JSON reporter; custom reporters only via the Inspector protocol ([reporters](https://bun.com/docs/test/reporters)). So the JSON/Markdown reports must be written by the eval file itself (`Bun.write` / `node:fs/promises`), which is trivial and is what the sketch below does.

**AI SDK 7 primitives it relies on (primary: `vercel/ai` source + docs).**
- `wrapLanguageModel({ model, middleware })` accepts `LanguageModelV2 | LanguageModelV3 | LanguageModelV4` and returns a model with `specificationVersion: 'v4'` ([`packages/ai/src/middleware/wrap-language-model.ts`](https://github.com/vercel/ai/blob/main/packages/ai/src/middleware/wrap-language-model.ts)). Middleware hooks are `transformParams`, `wrapGenerate`, `wrapStream` on a `readonly specificationVersion: 'v4'` object; `wrapGenerate` receives `{ doGenerate, doStream, params, model }` and returns the `LanguageModelV4GenerateResult` ([`language-model-v4-middleware.ts`](https://github.com/vercel/ai/blob/main/packages/provider/src/language-model-middleware/v4/language-model-v4-middleware.ts); [middleware docs](https://ai-sdk.dev/docs/ai-sdk-core/middleware)).
- `doGenerate` resolves to `LanguageModelV4GenerateResult = { content, finishReason, usage, providerMetadata?, request?, response?, warnings }`, and `LanguageModelV4Usage = { inputTokens: { total, noCache, cacheRead, cacheWrite }, outputTokens: { total, text, reasoning }, raw? }` ([generate-result](https://github.com/vercel/ai/blob/main/packages/provider/src/language-model/v4/language-model-v4-generate-result.ts), [usage](https://github.com/vercel/ai/blob/main/packages/provider/src/language-model/v4/language-model-v4-usage.ts)). That is exactly the per-call token capture [#168](https://github.com/rymanacevedo/SCC/issues/168) wanted from evalite's `wrapAISDKModel`, and because the roster already owns model construction, the wrap happens once at roster level.
- Structured-output failures surface as `NoObjectGeneratedError` (with `TypeValidationError` cause for schema mismatches) thrown from `Output.object` ([`generate-text/output.ts`](https://github.com/vercel/ai/blob/main/packages/ai/src/generate-text/output.ts)); a `try/catch` around the generator counts them for the schema-satisfaction rate without aborting the run ([#167](https://github.com/rymanacevedo/SCC/issues/167)).
- `ai/test` on `main` exports both `MockLanguageModelV3` and `MockLanguageModelV4` (plus V3/V4 embedding, image, speech, transcription, reranking, video mocks, `mockId`, `mockValues`) ([`packages/ai/test/index.ts`](https://github.com/vercel/ai/blob/main/packages/ai/test/index.ts)). The docs page only shows `MockLanguageModelV4` ([testing](https://ai-sdk.dev/docs/ai-sdk-core/testing)), so the existing V3-based unit tests keep compiling on `ai` 7 but should move to V4 when convenient (answers the [#178](https://github.com/rymanacevedo/SCC/issues/178) item 2 question).
- `generateText` result `usage` is flat (`inputTokens`, `outputTokens`, `totalTokens`, `inputTokenDetails.{noCacheTokens,cacheReadTokens,cacheWriteTokens}`, `outputTokenDetails.{textTokens,reasoningTokens}`, `raw`) and in 7 is summed across steps; `totalUsage` is deprecated ([generateText reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text); [migration guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0)). The generators return only `output`, so the eval cannot read this directly — hence the middleware.

**Scorers.** Blacklist hit, sentence-count/variant-count, non-empty `expertRecommended`, schema-satisfaction — all are string/array checks on the generator's typed output. Nothing in `autoevals` covers them, and its generic ones (`ValidJSON` schema check, `Levenshtein`) are redundant once the Zod schema has already validated the object. Adopt `autoevals`'s `Score` shape — `{ name: string; score: number | null; metadata?: Record<string, unknown> }` ([`js/score.ts`](https://github.com/braintrustdata/autoevals/blob/main/js/score.ts)) — as the in-repo contract so the scorers are drop-in for Braintrust or Langfuse later.

**Cost.** $0 beyond the model tokens the bake-off itself spends. Zero new dependencies.

**Maintenance.** ~150–200 lines of repo code, covered by the same `bun test` suite as `roster.test.ts`/`env.test.ts`. The only upstream surface is `wrapLanguageModel` + the V4 usage type, both in the `ai` package the backend already tracks.

**Review surface.** A Markdown file with one table per section: rows = fixtures (persona label), columns = roster models, cells = status (`ok`/`schema-error`), scores, tokens in/out, $/generation, and the output text (collapsed in `<details>`). Rendered by any editor or pasted into the [#170](https://github.com/rymanacevedo/SCC/issues/170) verdict comment. The JSON twin keeps every raw output and usage for later diffing or for feeding a UI if one is ever adopted.

### 2. Vercel AI SDK's own eval/telemetry options

**Finding: the AI SDK ships telemetry and test doubles, not an eval harness.** A web search for a first-party AI SDK eval product found only third-party integrations (DeepEval, Confident AI) and unrelated "harness" features (`HarnessAgent`, the Run SDK sandbox) ([ai-sdk.dev harnesses](https://ai-sdk.dev/docs/ai-sdk-harnesses), [Vercel weekly 2026-06-15](https://community.vercel.com/t/vercel-weekly-2026-06-15/43802), [Vercel weekly 2026-08-31](https://community.vercel.com/t/vercel-weekly-2026-08-31/48663), [DeepEval AI SDK integration](https://deepeval.com/integrations/frameworks/ai-sdk), [Confident AI changelog 2026-02-21](https://www.confident-ai.com/docs/changelog/2026/2/21)). The telemetry docs page does not mention evals ([telemetry](https://ai-sdk.dev/docs/ai-sdk-core/telemetry)).

**What exists (primary: docs + source).**
- `experimental_telemetry` "has graduated out of experimental status and has been renamed to `telemetry`"; "OpenTelemetry span collection is no longer built into the `ai` package" — it needs `@ai-sdk/otel` and `registerTelemetry(new OpenTelemetry())`; "In AI SDK 7, telemetry is opt-out: once you register a telemetry integration" all calls emit events ([migration guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0)). GenAI span attributes: `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.usage.cache_read.input_tokens`, `gen_ai.usage.cache_creation.input_tokens` ([telemetry](https://ai-sdk.dev/docs/ai-sdk-core/telemetry)).
- A custom integration without OTel: "Implement the `Telemetry` interface from the `ai` package. All methods are optional" — hooks include `onStart`, `onLanguageModelCallStart/End`, `onStepEnd` (the docs example logs `event.usage.totalTokens`), `onEnd`, `onAbort`, `onError`; registered globally via `registerTelemetry(...)` or per call via `telemetry.integrations` ([telemetry](https://ai-sdk.dev/docs/ai-sdk-core/telemetry)). In source: `export function registerTelemetry(...integrations: Telemetry[]): void` ([`telemetry-registry.ts`](https://github.com/vercel/ai/blob/main/packages/ai/src/telemetry/telemetry-registry.ts)); `GenerateTextStepEndEvent = StepResult` ([`generate-text-events.ts`](https://github.com/vercel/ai/blob/main/packages/ai/src/generate-text/generate-text-events.ts)), so it carries the step's `usage`, `response.modelId` and `output`.
- `@ai-sdk/otel` 1.0.138 (Apache-2.0) declares `ai: 7.0.138` as an exact **dependency**, i.e. it moves in lockstep with `ai` ([npm](https://registry.npmjs.org/@ai-sdk/otel)). Bun's `node:async_hooks` is "Partial": `AsyncLocalStorage` works but `createHook`/async IDs are stubs and context is not propagated into `Worker`/`MessagePort` ([Bun Node.js APIs](https://bun.com/docs/runtime/nodejs-apis)) — enough reason to avoid the OTel route for a Bun-run eval when the `Telemetry` interface or middleware gives the same numbers in-process.

**Verdict.** Building blocks, used by candidate 1. The `Telemetry` interface is a viable alternative to middleware for usage capture; middleware is preferred because [#168](https://github.com/rymanacevedo/SCC/issues/168) wants the capture attached at the roster level per model, and a global telemetry registration is process-wide.

### 3. Braintrust `autoevals` with a local runner

**autoevals 0.4.0** (published 2026-10-07; repo pushed 2026-10-08; 45 open issues; 1,056 stars; MIT) ([npm](https://registry.npmjs.org/autoevals), [repo](https://github.com/braintrustdata/autoevals), [LICENSE](https://github.com/braintrustdata/autoevals/blob/main/LICENSE)).
- Peer: `zod ^3.25.0 || ^4.0.0`; dependencies include `openai ^6.7.0`, `ajv`, `js-levenshtein`, `compute-cosine-similarity`, `linear-sum-assignment`, `mustache`, `js-yaml`, `zod-to-json-schema`. **No dependency or peer on `ai`** ([npm](https://registry.npmjs.org/autoevals)).
- Deterministic scorers exported: `ExactMatch` ([value.ts](https://github.com/braintrustdata/autoevals/blob/main/js/value.ts)), `Levenshtein`/`LevenshteinScorer` ([string.ts](https://github.com/braintrustdata/autoevals/blob/main/js/string.ts)), `JSONDiff`, `ValidJSON` (optional `schema`) ([json.ts](https://github.com/braintrustdata/autoevals/blob/main/js/json.ts)), `NumericDiff` ([number.ts](https://github.com/braintrustdata/autoevals/blob/main/js/number.ts)), `ListContains` ([list.ts](https://github.com/braintrustdata/autoevals/blob/main/js/list.ts)). LLM judges (`Factuality` etc.) use an OpenAI-compatible client set by `init({ client, … })`; the default model is `"gpt-5-mini"` ([oai.ts](https://github.com/braintrustdata/autoevals/blob/main/js/oai.ts)). It takes an `openai` SDK client, not an AI SDK `LanguageModel`.
- Scorer contract: `Scorer<Output, Extra> = (args: { output, expected? } & Extra) => Score | Promise<Score>`, `Score = { name, score: number | null, metadata? }` ([score.ts](https://github.com/braintrustdata/autoevals/blob/main/js/score.ts)).
- Bun: not documented; pure-JS dependencies, so likely fine, but unverified.

**`braintrust` 3.37.2 as the runner** (published 2026-10-09; repo pushed 2026-10-13, 89 open issues) ([npm](https://registry.npmjs.org/braintrust), [repo](https://github.com/braintrustdata/braintrust-sdk-javascript)).
- Licence discrepancy: npm metadata says MIT; the repository `LICENSE` is Apache License 2.0 ([LICENSE](https://github.com/braintrustdata/braintrust-sdk-javascript/blob/main/LICENSE)).
- 28 runtime dependencies including `esbuild 0.28.1`, `express ^5.2.1`, `@next/env`, `unplugin`; peers `zod ^3.25.34 || ^4.0` and optional `@types/react` ([npm](https://registry.npmjs.org/braintrust)). Bins: `bt` and `braintrust`.
- `Eval(name, { data, task, scores })` in `*.eval.ts`, run with `bt eval`, which "auto-detects a runner from `tsx`, `vite-node`, `ts-node`…" and accepts `--runner` with "`tsx`, `bun`, `ts-node`, `python`, etc." — so Bun *is* a documented runner ([run in code](https://www.braintrust.dev/docs/evaluate/run-in-code), [CLI eval reference](https://www.braintrust.dev/docs/reference/cli/eval)). Install notes say `bt eval` supports "Linux and macOS only" ([run in code](https://www.braintrust.dev/docs/evaluate/run-in-code)).
- Local mode: `--no-send-logs` (`BT_EVAL_LOCAL`) "Run without sending results to Braintrust" ([CLI eval reference](https://www.braintrust.dev/docs/reference/cli/eval)); in the SDK, `noSendLogs`: "Do not send logs to Braintrust. When true, the evaluation runs locally and builds a local summary instead of creating an experiment", implemented as `_internalInitEvaluatorExperiment(..., { disabled: Boolean(options.parent || options.noSendLogs) })` which returns `null` when disabled ([framework.ts](https://github.com/braintrustdata/braintrust-sdk-javascript/blob/main/js/src/framework.ts)). The CLI help text calls this "Useful for testing evaluators without uploading results" ([cli/index.ts](https://github.com/braintrustdata/braintrust-sdk-javascript/blob/main/js/src/cli/index.ts)) — i.e. it is a dry-run mode, not a local review surface; the docs do not say where results go or whether an API key is still needed.
- Review surface = the Braintrust app. Starter plan: $0, "1 GB included, then $4/GB", 10,000 scores, **14 days** data retention; Pro is $249/month ([pricing](https://www.braintrust.dev/pricing)).

**Verdict.** `autoevals` alone is harmless (no `ai` coupling, MIT, active) but adds `openai` + 7 other packages for scorers SCC does not need. The Braintrust runner makes the review surface a cloud account with 14-day retention on the free tier, and brings a heavy dependency tree. Not recommended now; keep as the first thing to try if LLM-as-judge scorers (explicitly deferred in [#163](https://github.com/rymanacevedo/SCC/issues/163)) are ever adopted.

### 4. Promptfoo

**promptfoo 0.124.1** (published 2026-10-08; repo pushed 2026-10-13; 709 open issues; 25,945 stars; MIT) ([npm](https://registry.npmjs.org/promptfoo), [repo](https://github.com/promptfoo/promptfoo), [LICENSE](https://github.com/promptfoo/promptfoo/blob/main/LICENSE)).
- **Runtime:** `engines.node >=22.22.0`. "Promptfoo requires Node.js `22.22.0` or newer"; "Node.js 24 LTS is recommended"; install methods are npm, npx, Homebrew; Bun is not mentioned ([installation](https://www.promptfoo.dev/docs/installation/)). Custom providers: "Promptfoo loads TypeScript providers in Node.js, not through your frontend bundler" ([custom API provider](https://www.promptfoo.dev/docs/providers/custom-api/)). A grep of the docs source for "bun" turned up no runtime guidance ([faq.md](https://github.com/promptfoo/promptfoo/blob/main/site/docs/faq.md)). So the bake-off would run under Node even though the rest of the repo runs under Bun — acceptable only if the dev wants a second runtime.
- **`ai` coupling:** no peer on `ai`, but a regular dependency `ai ^6.0.286` (plus `openai ^7.20.0`, `zod ^4.3.6`, `tsx`, `drizzle-orm`, `@libsql/client`, `posthog-node`, `express`, `socket.io`, … — 76 dependencies) ([npm](https://registry.npmjs.org/promptfoo)). It does not pin the backend's `ai`, but it installs a second `ai` major under `node_modules`.
- **Driving the seam:** a `file://./evals/promptfoo-provider.ts` class with `id()` and `callApi(prompt, context, options)` returning `ProviderResponse { output, error, tokenUsage: { total, prompt, completion }, cost, cached, metadata, … }` ([custom API provider](https://www.promptfoo.dev/docs/providers/custom-api/)). The provider would import `createSummaries` and the roster — the same ~40 lines of glue as candidate 1, plus a `promptfooconfig.yaml`.
- **Scorers:** deterministic assertions `contains`, `icontains`, `regex`, `equals`, `is-json`, `contains-json`, `cost` ("checks whether the cost reported by the selected provider is at or below a specified threshold"), `latency`, `levenshtein`, `word-count`, `javascript`, `python`, `webhook`, … ([deterministic assertions](https://www.promptfoo.dev/docs/configuration/expected-outputs/deterministic/)). JavaScript assertions take `file://` paths, receive `(output, context)` with `vars`, `prompt`, `providerResponse`, and may return a boolean, a number, or `{ pass, score, reason, namedScores?, componentResults? }`; for ESM the docs "recommend pointing promptfoo to the transpiled plain Javascript output" ([javascript assertions](https://www.promptfoo.dev/docs/configuration/expected-outputs/javascript/)) — a build step SCC does not otherwise have.
- **Review surface:** `promptfoo view` shows a results table with per-cell details, display filters, manual pass/fail and 0–1 scores, Pass Rate / Score Distribution charts, optional tokens/latency/cost columns, and exports YAML/CSV/JSON ([web UI](https://www.promptfoo.dev/docs/usage/web-ui/)). `promptfoo eval -o` writes "csv, txt, json, jsonl, yaml, yml, html, xml, junit.xml"; `--no-write` skips the `~/.promptfoo` history ([command line](https://www.promptfoo.dev/docs/usage/command-line/)).
- **Telemetry:** "collects basic usage telemetry by default" (commands, assertion types, version, CI flag; with account info also user id/email); disable with `PROMPTFOO_DISABLE_TELEMETRY=1` ([telemetry](https://www.promptfoo.dev/docs/configuration/telemetry/)).

**Verdict.** The best UI of the lot and genuinely cheap ($0, local SQLite history), but Node-only, 76 dependencies, a nested `ai` 6, default telemetry, and a transpile step for TS assertions. For a 3×3 bake-off a Markdown table is the review surface; if the harness later grows into a regression gate with hundreds of cases, Promptfoo is the first upgrade to re-evaluate — the in-repo JSON report maps 1:1 onto a Promptfoo provider.

### 5. Langfuse (local evaluation via `@langfuse/client`)

- `@langfuse/client` 5.13.1 (published 2026-10-07; MIT; peer `@opentelemetry/api ^1.9.0`; depends on `@langfuse/core`, `@langfuse/tracing`, `mustache`) ([npm](https://registry.npmjs.org/@langfuse/client)). `@langfuse/tracing` declares `engines.node >=20` ([npm](https://registry.npmjs.org/@langfuse/tracing)). The legacy `langfuse` 3.39.2 package is still published (2026-09-15) ([npm](https://registry.npmjs.org/langfuse)). No `ai` coupling. Bun not documented.
- Experiments: `langfuse.experiment.run({ name, data, task, evaluators?, runEvaluators?, maxConcurrency?, metadata? })`; `data` may be a local array of `{ input, expectedOutput }`; item-level evaluators return `{ name, value, comment? }` and "SDK evaluators run in your process"; `createEvaluatorFromAutoevals` wraps autoevals; results are viewed in the Langfuse Experiments UI and "OpenTelemetry must be properly set up for traces to be delivered to Langfuse" ([experiments via SDK](https://langfuse.com/docs/evaluation/experiments/experiments-via-sdk)). The page does not describe any offline mode; the review surface is the server.
- Server: Cloud Hobby is $0 with 50k units/month, 2 users, 30 days of data access; Core is $29/month ([pricing](https://langfuse.com/pricing)). Self-hosting needs Langfuse Web + Worker, PostgreSQL, Redis/Valkey, ClickHouse and S3/blob storage; Docker Compose is "Single VM without high availability, scaling, or backups" ([self-hosting](https://langfuse.com/self-hosting)). Server licence: MIT except `ee/` directories ([LICENSE](https://github.com/langfuse/langfuse/blob/main/LICENSE)); SDK repo MIT ([LICENSE](https://github.com/langfuse/langfuse-js/blob/main/LICENSE)). Repos active: langfuse-js pushed 2026-10-12 (57 open issues), langfuse pushed 2026-10-13 (1,037 open issues) ([GitHub API](https://api.github.com/repos/langfuse/langfuse-js), [GitHub API](https://api.github.com/repos/langfuse/langfuse)).

**Verdict.** Good evaluator model (identical to candidate 1's contract) but the harness is the server: either a cloud account with 30-day retention or a four-service self-host. Over-scaled for a solo nonprofit bake-off; the OTel dependency also runs into Bun's partial `async_hooks`.

### 6. LangSmith (local evaluation via `langsmith`)

- `langsmith` 0.10.12 (published 2026-10-13; MIT; only dependency `p-queue`; optional peers `ws`, `openai`, `@opentelemetry/*`) ([npm](https://registry.npmjs.org/langsmith), [LICENSE](https://github.com/langchain-ai/langsmith-javascript/blob/main/LICENSE)). No `ai` coupling. Bun not documented.
- `evaluate(target, { data, evaluators, experimentPrefix, maxConcurrency, metadata })`; `data` is "the name OR UUID of the LangSmith dataset to evaluate on, or an iterator of examples"; "Each `evaluate()` call creates an experiment, viewable in the LangSmith UI experiments table"; no local/offline mode is mentioned ([evaluate an LLM application](https://docs.langchain.com/langsmith/evaluate-llm-application)); "LangSmith displays all experiments associated with a dataset" ([evaluation concepts](https://docs.langchain.com/langsmith/evaluation-concepts)).
- Plans: Developer "$0 / seat per month", "Up to 5k base traces / mo", 1 seat, base traces retained 14 days; Plus $39/seat/month; "Self-hosted and hybrid deployment options" are Enterprise-only ([pricing](https://www.langchain.com/pricing)). The server is not open source.

**Verdict.** Cloud-only in practice, 14-day retention on the free plan, proprietary server. Not a fit.

### 7. evalite (removed — status for the record)

- npm `latest` is 0.19.0 (2025-11-06) with no peers; the `beta` tag `1.0.0-beta.16` (2026-02-20, the version SCC had) declares `peerDependencies: { "better-sqlite3": "^11.6.0", "ai": "^6" }` ([npm](https://registry.npmjs.org/evalite)).
- Repo last pushed 2026-04-28, 65 open issues, MIT; issue [#400 "Support for AI SDK v7 in peerDependencies"](https://github.com/mattpocock/evalite/issues/400) has been open since 2026-06-29 ([GitHub API](https://api.github.com/repos/mattpocock/evalite)). No release has shipped since the `ai` 7.0.0 publish on 2026-06-25. Removal was the right call; do not reintroduce ([#174](https://github.com/rymanacevedo/SCC/issues/174) standing preference).

## Smallest viable integration (recommended option)

Files are relative to `packages/backend/`. Unchanged: `evals/roster.ts`, `evals/env.ts`, `evals/fixtures/summaries.ts`, and their tests.

```
evals/
  roster.ts               (unchanged)
  env.ts                  (unchanged)
  fixtures/summaries.ts   (unchanged)
  setup.ts                (restored: applyEvalEnvironment(..) — preload)
  usage.ts                (new: withUsageCapture() middleware + UsageRecord)
  pricing.ts              (new: dated $/1M map + costUsd(usage, modelId))   -> #168
  scorers/summaries.ts    (new: pure scorers returning Score[])             -> #167
  report.ts               (new: writeReports(run) -> JSON + Markdown)
  summaries.eval.ts       (new: the runner)
  results/                (gitignored)
```

`package.json` scripts (replace the removed `eval:dev`/`eval:run`):

```json
"eval": "bun test ./evals/summaries.eval.ts --preload ./evals/setup.ts --timeout 60000",
"eval:all": "bun test ./evals/summaries.eval.ts ./evals/skills.eval.ts ./evals/experience.eval.ts --preload ./evals/setup.ts --timeout 60000"
```

`evals/usage.ts` — roster-level token capture via middleware (all type names from the `ai` 7 / V4 sources cited above):

```ts
import { type LanguageModel, type LanguageModelMiddleware, wrapLanguageModel } from 'ai';

export type UsageRecord = {
  modelId: string;
  inputTokens: number | undefined;
  outputTokens: number | undefined;
};

export function withUsageCapture(model: LanguageModel, sink: UsageRecord[]): LanguageModel {
  const middleware: LanguageModelMiddleware = {
    specificationVersion: 'v4',
    wrapGenerate: async ({ doGenerate, model }) => {
      const result = await doGenerate();
      sink.push({
        modelId: result.response?.modelId ?? model.modelId,
        inputTokens: result.usage.inputTokens.total,
        outputTokens: result.usage.outputTokens.total,
      });
      return result;
    },
  };
  return wrapLanguageModel({ model, middleware });
}
```

`evals/summaries.eval.ts` — the runner (one `test` per roster × fixture cell so `--timeout` applies per call; no assertions, because an eval is not pass/fail per the glossary):

```ts
import { afterAll, describe, test } from 'bun:test';
import { createSummaries } from '../src/services/ai';
import { readEvalEnvironment } from './env';
import { summaryFixtures } from './fixtures/summaries';
import { costUsd } from './pricing';
import { type EvalRun, writeReports } from './report';
import { buildEvalName, modelRoster } from './roster';
import { scoreSummaries } from './scorers/summaries';
import { type UsageRecord, withUsageCapture } from './usage';

const run: EvalRun = { section: 'Summaries', startedAt: new Date().toISOString(), cells: [] };

for (const entry of modelRoster) {
  describe(buildEvalName('Summaries', entry.modelId), () => {
    for (const fixture of summaryFixtures) {
      test(fixture.label, async () => {
        const usage: UsageRecord[] = [];
        const model = withUsageCapture(entry.createModel(readEvalEnvironment(process.env)), usage);
        try {
          const summaries = await createSummaries(fixture.prompt, model);
          run.cells.push({ modelId: entry.modelId, fixture: fixture.label, status: 'ok',
            output: summaries, scores: scoreSummaries(summaries), usage, costUsd: costUsd(usage) });
        } catch (error) {
          run.cells.push({ modelId: entry.modelId, fixture: fixture.label, status: 'error',
            error: error instanceof Error ? error.message : String(error), usage, costUsd: costUsd(usage) });
        }
      });
    }
  });
}

afterAll(() => writeReports(run)); // evals/results/<startedAt>-summaries.{json,md}
```

`evals/report.ts` writes the JSON verbatim and a Markdown table with fixture rows × roster columns (status, scores, tokens, $, output in `<details>`), plus a per-model footer: schema-satisfaction rate, mean $/generation, Blacklist hits. `evals/scorers/summaries.ts` and `evals/pricing.ts` are pure and get co-located `*.test.ts` files like `roster.test.ts` — this is exactly the split [#167](https://github.com/rymanacevedo/SCC/issues/167) and [#168](https://github.com/rymanacevedo/SCC/issues/168) specify, with "evalite UI" replaced by "Markdown report" in their acceptance criteria. Skills/Experience ([#166](https://github.com/rymanacevedo/SCC/issues/166)) reuse `usage.ts`, `pricing.ts`, `report.ts` with their own fixtures and scorers.

Glossary follow-up: the **Eval** entry should name the runner (`bun test ./evals/*.eval.ts`, reports in `evals/results/`) once this lands, and **Test** vs **Eval** stay distinguished by file suffix (`*.test.ts` vs `*.eval.ts`) and by invocation (`bun test` with no path vs `bun run eval`).

## Open questions / unverified

1. **Does `bun test ./evals/summaries.eval.ts` execute a file whose name does not match the default `*.test.*`/`*.spec.*` patterns?** The Bun docs say an argument starting with `./` is treated as a path, but every example uses a `*.test.ts` name, and I could not locate the test-command source on GitHub to confirm. One-minute check for the dev. If it does not run, use `bun evals/summaries.eval.ts` with the `describe/test` wrapper swapped for a plain loop (`--timeout` then becomes a manual `AbortSignal.timeout` per call) — nothing else changes.
2. **Bun runtime compatibility of `autoevals`, `@langfuse/client`, `langsmith`, and Promptfoo** is undocumented by each project; none claims Bun support. Not needed for the recommendation.
3. **Braintrust `--no-send-logs` without an API key**: the SDK skips experiment creation, but neither the docs nor the code I read establish whether login is still attempted first.
4. **`braintrust` licence**: npm metadata says MIT, the repository `LICENSE` is Apache-2.0. Treat as Apache-2.0 until clarified.
5. **Langfuse/LangSmith server-side cost computation** was not verified (not needed; the PRD wants a dated static pricing map in-repo regardless).
6. **`response.modelId` in `LanguageModelV4GenerateResult`** is optional per the type; the sketch falls back to the wrapped model's `modelId`. Verify Gemini populates it if the report should show the provider's resolved model version.
7. **AI SDK 7 behaviour of `Output.object` when the provider returns a non-conforming object** (error class and whether `usage` is still reported on the thrown path) was read from source (`NoObjectGeneratedError`) but not executed; the middleware records usage before `Output` parsing, so cost is captured even on schema failures, which is what [#167](https://github.com/rymanacevedo/SCC/issues/167) needs.
8. **Web search results** for "first-party AI SDK evals" were secondary sources used only to establish absence; the positive claims above all come from the AI SDK docs/source.
