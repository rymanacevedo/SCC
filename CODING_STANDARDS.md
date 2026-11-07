# Coding Standards

- The rules a reviewer applies by judgement. A rule a tool enforces is not
  repeated here.
- `bun run check` (oxfmt, oxlint), `bun run typecheck`, `bun test` and
  `bun run build` run in the `ci` workflow. Pre-commit runs lint-staged on
  the staged files; pre-push runs typecheck and the tests.
- `.oxlintrc.json`, `.oxfmtrc.json` and `tsconfig*.json` are the source of
  truth for formatting, lint and type rules.
- The Review section is the Standard's fixed text. The ruleset it describes
  lives in repository settings (`gh api repos/rymanacevedo/SCC/rulesets`),
  not in this repo.

## Tests

Source: the repo layout (`app/`, `shared/`, `worker/`).

- Tests sit beside the module they cover, as `<module>.test.ts` or
  `.test.tsx`, not in a separate tree.
- A behaviour change comes with a test in that file.

## Domain vocabulary

Source: `docs/agents/domain.md`.

- Names in code, tests and issues use the terms in the context's
  `GLOSSARY.md` (`worker/`, `app/`, via `GLOSSARY-MAP.md`), not synonyms the
  glossary avoids. A new concept gets a glossary entry in the same PR.
- ADRs live in `docs/adr/` (system-wide) and `<context>/docs/adr/`; the
  directories are created with the first ADR. A change that contradicts an
  ADR says so and records the new decision; it does not override silently.

## Review

Every PR goes through the same review before it merges, whoever opened it:

- Every PR gets a council round and a security review, run from this repo's attached sandbox with `/council <PR>`, before merge.
- The `standard` ruleset on the default branch requires both statuses, `council/review` and `security/daybreak`, beside `ci`; a PR cannot merge without them.
- A PR opened outside a sandbox (by hand from the host, or by another runner) waits, red, until someone runs `/council <PR>` in the attached sandbox.
- A push that changes the diff needs a new round and a new security review. Merging the base into the branch without changing the diff only re-posts the statuses.
