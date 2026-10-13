# System — Context Glossary

Terms that span every context of SCC: how the code and the generated content are judged. Context-specific vocabulary lives in the per-context glossaries listed in `GLOSSARY-MAP.md`.

## Quality measurement

### Test
A deterministic check of *code* behavior. A failing test means the code is wrong. Every test is written against the `bun:test` API; all kinds except the Flow test run under a bare `bun test` and in the pre-push hook. No test touches the network or a real model.
_Avoid_: spec, check

### Component test
A Test that renders one component and asserts on the result. The default tier renders to a markup string with no DOM. The behaviour tier mounts the component in a simulated DOM, drives its events, and asserts the DOM afterwards; it is reserved for components that own client state.
_Avoid_: UI test, snapshot test

### Controller test
A Test that drives one builder page's route actions by handing the app router a request and asserting the HTTP shape (status, redirect target) and the storage side effect. Rendered content is never asserted here; that is the Component test's job.
_Avoid_: route test, action test, loader test

### Contract test
A Test that drives the real API router with a request and asserts the HTTP contract: status, headers, and the Error envelope. Middleware gets its own unit tests on a throwaway router; the Contract test covers the assembled surface.
_Avoid_: route test, integration test, API test

### Flow test
A Test that drives the built app in a real browser through a user journey, with the model stubbed. The only kind that can prove navigation, history, and the rendering-model must-checks. Runs by explicit path, never under a bare `bun test` or a git hook.
_Avoid_: e2e, end-to-end test, browser test, smoke test

### Eval
A measurement of *model/prompt output quality* — not pass/fail on code. Lives in `evals/` (fixtures, model roster, eval environment), calls real models through the generation seam, costs real tokens, and is judged by scorers plus human review. A "failing" eval means a model or prompt performs worse, not that code is broken. Evals compose their own `LanguageModel`s (any provider, via the AI SDK) and never go through HTTP routes or `resolveModel`.

### Bake-off
A one-shot comparative eval across a fixed **roster** of candidate models over the same fixtures, run to make a model-selection decision. The verdict is human; if it changes the production model, that change is recorded as its own ADR and commit — a bake-off never mutates production configuration itself.
