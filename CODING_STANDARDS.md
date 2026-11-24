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
  - Exception: `bun test` skips dot-directories, so tests for code under
    `.claude/` sit in `test/` at the same relative path (e.g.
    `test/hooks/` for `.claude/hooks/`).
- A behaviour change comes with a test in that file.

## Domain vocabulary

Source: `docs/agents/domain.md`.

- Names in code, tests and issues use the terms in the context's
  `GLOSSARY.md` (`worker/`, `app/`, via `GLOSSARY-MAP.md`), not synonyms the
  glossary avoids. A new concept gets a glossary entry in the same PR.
- ADRs live in `docs/adr/` (system-wide) and `<context>/docs/adr/`; the
  directories are created with the first ADR. A change that contradicts an
  ADR says so and records the new decision; it does not override silently.

## Comments

Source: issue #275 and the ADRs in `docs/adr/`.

Code carries no comments except license headers, `// prettier-ignore`, tool directives and pragmas, doc comments that define a public API contract, and style-only lint suppressions. Reasoning behind a decision lives in an existing ADR, not in the code. ADRs are kept sparse: extend an existing one rather than adding a new one for a single comment.

## Review

Every PR goes through Jev classification and its assigned review tier before it merges, whoever opened it:

- Run `/council <PR>` from this repo's attached everyday sandbox before merge. Jev classifies the diff from git into a review tier (`T0` human review only, `T1` one-judge council round, `T2` three-judge council round and security review, `T3` adding a host-started CVP blue review). Use `/council <PR> --full` to raise a PR to at least `T2`.
- The `standard` ruleset on the default branch requires `council/review`, `security/daybreak`, and `security/claude-cvp` beside `ci`; a PR cannot merge without them. Below `T3`, reporting posts `security/claude-cvp` as not required at that tier; at `T3`, only the host posts its result via `sbxc cvp blue` in a containment profile.
- A PR opened outside an everyday sandbox (by hand from the host, or by another runner) waits, red, until someone runs `/council <PR>` in the attached everyday sandbox.
- A push that changes the diff is classified again and needs the review its new tier demands. Merging the base into the branch without changing the diff only re-posts the statuses (and on `T3` PRs, the human re-runs `sbxc cvp blue` on the host).
