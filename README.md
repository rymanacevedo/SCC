# SCC — Resume builder

SCC helps people write a resume by answering simple questions section by section.
The Remix v3 migration begins with a client-rendered shell and a JSON API fallback;
builder pages and API routes follow in separate migration tickets.

Use Node 24 (at least 24.3.0) and Bun 1.4.3. Install from the root with `bun install`.

[`.env.schema`](.env.schema), the environment schema, lists every environment key
the repo reads, which are secrets and what each accepts. Local secrets go in `.dev.vars`,
which git ignores: `OPENAI_API_KEY` and `GITHUB_TOKEN` are required, and
`ALLOWED_COUNTRIES` and `GITHUB_REPO` come from `wrangler.jsonc`. Sandcastle reads
`GH_TOKEN` from `.sandcastle/.env`, which git also ignores. Declare a new key
in the environment schema in the PR that first reads it
([ADR-0002](docs/adr/0002-varlock-environment-schema.md)).

Varlock also reads `.env` and `.env.local` at the repo root, and git ignores every
`.env*` file except `.env.schema`, so such a file does not show in `git status`. A key
in one of them that the environment schema does not declare is treated as a required
secret. Clear stray keys out of `.env.local` before running `bun run env:check`.

- `bun run dev`: Vite client and Worker on http://localhost:5173.
- `bun run build` and `bun run preview`: build and serve in workerd.
- `bun run typecheck`: regenerate Worker types and check both TypeScript projects.
- `bun run env:check`: check values against the environment schema with
  [Varlock](https://varlock.dev), naming each key that is missing or malformed. Each
  value comes from `.dev.vars` if it is there, then from the `wrangler.jsonc` vars,
  then from the shell environment. A secret that is exported in the shell and absent
  from `.dev.vars` therefore passes, although the local Worker would not get it.
- `bun run test`: deterministic Tests, with one shared happy-dom preload.
- `bun run test:e2e`: fails until the Flow test ticket supplies the runner.
- `bun run evals`: reserved for the replacement harness in #189; never part of Tests.

`app/` contains the browser application, `worker/` the API and generation seam,
`shared/` their schemas, `evals/` the model roster and corpus, and `test/` shared
Test support. Domain vocabulary starts at [GLOSSARY-MAP.md](GLOSSARY-MAP.md).
The analytics token in `index.html` is filled by the dev during cutover.
Deployment and cutover remain dev-run; see [the runbook](docs/runbooks/remix-v3-cutover.md).
