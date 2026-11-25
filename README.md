# SCC — Resume builder

SCC helps people write a resume by answering simple questions section by section.
The Remix v3 migration begins with a client-rendered shell and a JSON API fallback;
builder pages and API routes follow in separate migration tickets.

Use Node 24 (at least 24.3.0) and Bun 1.4.3. Install from the root with `bun install`.

[`.env.schema`](.env.schema), the environment schema, lists every environment key
SCC reads, which are secrets and what each accepts. Local secrets go in `.dev.vars`,
which git ignores: `OPENAI_API_KEY` and `GITHUB_TOKEN` are required, and
`ALLOWED_COUNTRIES` and `GITHUB_REPO` come from `wrangler.jsonc`. Declare a new key
in the environment schema in the PR that first reads it
([ADR-0002](docs/adr/0002-varlock-environment-schema.md)).

- `bun run dev`: Vite client and Worker on http://localhost:5173.
- `bun run build` and `bun run preview`: build and serve in workerd.
- `bun run typecheck`: regenerate Worker types and check both TypeScript projects.
- `bun run env:check`: check the values the local Worker would get (`wrangler.jsonc`
  vars, `.dev.vars`, then the process environment) against the environment schema with
  [Varlock](https://varlock.dev), naming each key that is missing or malformed.
- `bun run test`: deterministic Tests, with one shared happy-dom preload.
- `bun run test:e2e`: fails until the Flow test ticket supplies the runner.
- `bun run evals`: reserved for the replacement harness in #189; never part of Tests.

`app/` contains the browser application, `worker/` the API and generation seam,
`shared/` their schemas, `evals/` the model roster and corpus, and `test/` shared
Test support. Domain vocabulary starts at [GLOSSARY-MAP.md](GLOSSARY-MAP.md).
The analytics token in `index.html` is filled by the dev during cutover.
Deployment and cutover remain dev-run; see [the runbook](docs/runbooks/remix-v3-cutover.md).
