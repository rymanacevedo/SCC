<!-- standard:draft -->
# Coding Standards

Drafted from the repo's lint, format and TypeScript configuration plus
`AGENTS.md`. Every rule below is stated by one of those sources. The owner
reviews this file and deletes the first line (the draft marker) to adopt it.

## Priorities

Source: `AGENTS.md`.

1. Performance first.
2. Reliability first.
3. Keep behavior predictable under load and during failures (session
   restarts, reconnects, partial streams).

If a tradeoff is required, choose correctness and robustness over short-term
convenience.

## Maintainability

Source: `AGENTS.md`.

- Long term maintainability is a core priority.
- Before adding new functionality, check whether shared logic can be extracted
  to a separate module.
- Duplicate logic across multiple files is a code smell and is avoided.
- Change existing code where that is the right fix. Do not take shortcuts by
  adding local logic to solve a problem.

## Toolchain

Source: `package.json`, `.node-version`.

- Package manager: Bun (`packageManager` pins `bun@1.4.3`).
- Node: `>=24.3.0`.
- Lint: `oxlint` (`bun run lint`, `bun run lint:fix`).
- Format: `oxfmt` (`bun run format`, `bun run format:check`).
- Combined check: `bun run check` runs `oxfmt --check && oxlint`.
- Types: `bun run typecheck` regenerates Worker types with `wrangler types`
  and then runs `tsc` against `tsconfig.json` and `tsconfig.worker.json`.
- Tests: `bun test`. Do not run it unless instructed.
- `bun run dev` starts the app and Worker. Do not run it unless instructed.

## TypeScript

Source: `tsconfig.base.json`, `tsconfig.json`, `tsconfig.worker.json`.

- `strict` is on.
- `noFallthroughCasesInSwitch` is on.
- `verbatimModuleSyntax` is on: type-only imports and exports use the `type`
  modifier.
- Module and resolution are `NodeNext`; `allowImportingTsExtensions` is on, so
  relative imports may name the `.ts` / `.tsx` file.
- Two compilation units:
  - `tsconfig.json`: `app/`, `shared/`, `test/`, `e2e/`, with DOM libs and
    JSX via `remix/component` (`jsx: react-jsx`).
  - `tsconfig.worker.json`: `worker/`, `shared/`, `evals/`,
    `test/mock-model.ts`, with ESNext lib only and Worker bindings typed by
    `worker-configuration.d.ts`.
- `shared/` compiles under both units, so it uses nothing DOM-only and nothing
  Worker-only.

## Lint rules

Source: `.oxlintrc.json`. Plugins: `typescript`, `unicorn`, `oxc`, `react`.
Every rule in the `correctness` category is an error.

- `no-unused-vars` is an error. Unused variables, arguments and caught errors
  are allowed only when prefixed with `_`; rest siblings are ignored.
- `typescript/no-explicit-any` is an error: no `any`.
- `react/no-array-index-key` is an error: do not use an array index as a key.
- `no-console` is a warning.
- `typescript/no-non-null-assertion` is a warning.
- `react/jsx-key` is a warning.
- `react/react-in-jsx-scope` is off.
- In `app/**` and `shared/**`, importing `zod` directly is an error. Client
  code imports `z` from `shared/zod.ts` (zod/mini); full zod adds startup
  cost to every page.
- Ignored paths: `dist`, `build`, `.cache`, `.ona`, `bin`, `.wrangler`,
  `worker-configuration.d.ts`, `docs`.

## Formatting

Source: `.oxfmtrc.json`.

- 2-space indentation, no tabs.
- Print width 80.
- Single quotes in TypeScript; double quotes in JSX attributes.
- Semicolons on.
- Trailing commas everywhere (`all`).
- Arrow function parameters always parenthesised.
- Object property quotes only as needed.
- Bracket spacing on; the closing `>` of a multi-line JSX tag goes on its own
  line.
- Imports are sorted with no blank lines between groups.
- `package.json` is not re-sorted.
- Markdown (`*.md`), `docs`, `.agents`, `.claude`, `.codex` and build output
  are not formatted.

## Commit hooks

Source: `.husky/pre-commit`, `.lintstagedrc.json`.

- A commit that stages a `.env`, `.pem` or `.key` file is blocked.
- `lint-staged` runs on staged files: `oxfmt` then `oxlint --fix` on
  `.ts`, `.tsx`, `.mts`, `.cts`, `.mjs`; `oxfmt` on JSON, JSONC, YAML, TOML,
  CSS and HTML.

## Domain vocabulary

Source: `AGENTS.md`.

- `GLOSSARY-MAP.md` at the root points to a per-context `GLOSSARY.md`
  (`worker`, `app`). See `docs/agents/domain.md`. Use the glossary terms.
- Issues are tracked in GitHub Issues for `rymanacevedo/SCC` via the `gh` CLI.
  See `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md`.

## Review

Every PR goes through the same review before it merges, whoever opened it:

- Every PR gets a council round and a security review, run from this repo's attached sandbox with `/council <PR>`, before merge.
- The `standard` ruleset on the default branch requires both statuses, `council/review` and `security/daybreak`, beside `ci`; a PR cannot merge without them.
- A PR opened outside a sandbox (by hand from the host, or by another runner) waits, red, until someone runs `/council <PR>` in the attached sandbox.
- A push that changes the diff needs a new round and a new security review. Merging the base into the branch without changing the diff only re-posts the statuses.
