---
status: accepted
date: 2026-11-25
---

# ADR-0002: The environment schema declares every key; Varlock checks it, and deploys stay on stock Wrangler

SCC's environment keys were listed in three places that nothing compared: `.dev.vars.example` (two secrets), the `vars` in `wrangler.jsonc` (two keys) and the zod schemas in `worker/lib/environment.ts` (six keys). The two secrets the Worker requires, `OPENAI_API_KEY` and `GITHUB_TOKEN`, were declared nowhere a tool could check before a request arrived.

We decided that **`.env.schema`, the environment schema, is the one declared list**, and [Varlock](https://varlock.dev) (pinned exactly, `1.25.0`) checks values against it. It declares the Worker's six keys and the eval-only `GEMINI_API_KEY`, marks the three API credentials as secrets, and replaces `.dev.vars.example`. Varlock is used as a CLI only: no module imports it, the Worker still reads `env` from `cloudflare:workers`, and `worker/lib/environment.ts` is still the check that runs in production, per scope, when a request needs the keys.

## Decisions

- **`bun run env:check` checks the values the local Worker would get.** `build/environment-check.ts` asks Wrangler for them (`wrangler.jsonc` vars with `.dev.vars` laid over them, the same call `vite dev` uses), lays them over the process environment and runs `varlock load`. Varlock cannot read `.dev.vars` itself (`@import` accepts only `.env.*` files), and `.dev.vars` stays the local values file because the Flow test runner, the eval environment and the cutover runbook write or read it. In CI there is no `.dev.vars`, so the step supplies stub values for the two required secrets and the Wrangler vars are checked as committed.
- **The other two lists stay and are held to the environment schema by a Test.** `test/env-schema.test.ts` runs the real `varlock` binary against the committed schema and fails when the schema's keys differ from the zod schemas' keys plus the eval-only key, when a Wrangler var is undeclared or marked secret, or when a key is required on one side and optional on the other.
- **The environment schema sets no default and uses no `@type=number`.** `US` and `rymanacevedo/SCC` stay in `wrangler.jsonc`, and `gpt-5-nano` stays in `worker/services/model.ts` ([Worker ADR-0001](../../worker/docs/adr/0001-env-driven-model-selection.md)). `ALLOWED_COUNTRIES` is checked as text with a regex that mirrors `parseAllowedCountries`.
- **`GEMINI_API_KEY` is declared optional.** Only Evals read it, CI has no value for it, and it must never be set on the Worker.
- **The environment schema is not stricter than the Worker, with two named exceptions.** Varlock refuses a secret shorter than three characters (it cannot redact one safely; `allowShortValue` does not lift this), and the country regex refuses a code that is two ASCII letters only after upper-casing (`ß`). In the other direction, Varlock reads an empty `OPENAI_BASE_URL` or `OPENAI_MODEL` as unset while the Worker rejects an empty string, so a `.dev.vars` must omit an optional key rather than leave it empty. The Test lists each case by name.
- **Wrangler's `secrets.required` is not used.** Once it is set, local dev takes from `.dev.vars` only the keys that are Wrangler vars or listed as required, so the `OPENAI_BASE_URL` the Flow test runner writes would be dropped and the Flow test's Worker would call the real provider. An optional key cannot be listed, or deploys fail while it is unset.

## Examined and deferred: the Vite plugin and the deploy wrapper

Varlock's Cloudflare integration (`@varlock/cloudflare-integration` 1.6.4) is a Vite plugin plus `varlock-wrangler`, a wrapper around `wrangler deploy`. Neither is adopted.

- **The two are coupled.** A Worker built with the plugin reads a `__VARLOCK_ENV` binding at module load and throws at boot when it is absent. Only the wrapper sets that binding, so the plugin cannot ship while any deploy path still runs stock Wrangler.
- **Deploys do not run from this repo.** Cloudflare Workers Builds runs `bunx wrangler deploy` on `main` and `bunx wrangler versions upload` on every other branch, configured in the dashboard. Adopting the wrapper means changing both commands there and giving the build the secret values, which no PR can do or verify.
- **The wrapper takes ownership of the Worker's vars and secrets.** It deploys with `--keep-vars=false` and uploads every schema key with the value resolved on the deploying machine. Varlock's documentation says vars and secrets that are not in the schema are removed on the next deploy; Wrangler 4.150.0's client code suggests secrets survive. This was not tested against the account, so the documented behaviour is the one to plan for. A stub or missing value in the build environment would overwrite a good secret or block the deploy.
- **Both need `nodejs_compat`** and turn on log redaction and response-body leak scanning by default, which changes the runtime of a Worker that streams model output.
- **The plugin refuses to start while a `.dev.vars` exists**, so the Flow test runner, the eval environment and the runbook would all change in the same step.

## Consequences

- A key the Worker starts reading is declared in `.env.schema` in the same PR; the Test fails otherwise. A new Wrangler var needs no second edit unless it is also new to the zod schemas.
- A missing or malformed value is caught by `bun run env:check` on a developer's machine before `bun run dev`, and in CI for the committed Wrangler vars. It is not caught at Worker startup: validation stays lazy and per request, and the secrets set on Cloudflare are never checked against the environment schema by anything in this repo.
- The stub secrets in the CI step prove the schema loads and the check works; they say nothing about production values.
- `build/environment-check.ts` uses Wrangler's `unstable_readConfig` and `unstable_getVarsForDev`. A Wrangler upgrade that changes them fails `build/environment-check.test.ts`.
- Varlock 1.25.0 warns on a URL without `://`, with a non-http scheme or with whitespace and says the next major will reject them; the Worker accepts those today. Bump Varlock in its own PR and rerun the Test.
- Closing the remaining gaps (one list instead of three, a check at boot) means adopting the wrapper and the plugin together, with the owner changing the Workers Builds commands, recording `wrangler secret list --name scc` first and running the first wrapped deploy by hand.

Decided in https://github.com/rymanacevedo/SCC/issues/284.
