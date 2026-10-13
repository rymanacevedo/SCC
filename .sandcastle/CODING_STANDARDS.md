# Coding Standards

Loaded by the Sandcastle reviewer via `@.sandcastle/CODING_STANDARDS.md`. The
implementer does not read this file; `AGENTS.md` carries the project priorities
for both phases.

## Priorities (from AGENTS.md)

- Performance first, reliability first. Behaviour must stay predictable under
  load and during failures (session restarts, reconnects, partial streams).
- When a tradeoff is required, choose correctness and robustness over
  short-term convenience.
- Long-term maintainability: before adding logic, look for shared logic to
  extract into a module. Duplicate logic across files is a code smell. Change
  existing code rather than bolting on local workarounds.

## Style (enforced by Biome, `biome.json` at the root)

- Two-space indent, single quotes in TS, double quotes in JSX, trailing commas,
  semicolons, parentheses around arrow parameters. Run `bun run check` to see
  what the pre-commit hook will flag.
- `noExplicitAny` is an error: no `any`, no unchecked casts to escape the type
  system. `noArrayIndexKey` is an error: never use an array index as a React key.
- `noConsole` warns: no stray `console.*` in committed code outside scripts.
- Imports are organized by Biome; do not hand-order them.
- Bun only: `bun`, `bun x`, `bun run`. Never `npm`, `npx`, `yarn`, or `pnpm`
  (the `.claude/hooks/enforce-bun.sh` hook blocks them).

## Naming and vocabulary

- Use the domain terms from the context glossaries (`GLOSSARY-MAP.md` points to
  `worker/GLOSSARY.md`, `app/GLOSSARY.md`). Capitalised glossary terms such as Section,
  Hub page, Blacklist, Error envelope, Same-origin guard name real concepts;
  match them in identifiers and comments.
- New domain concepts get a glossary entry in the same change.

## Testing

- `bun test` is the suite; `bun run typecheck` must pass in both TypeScript projects.
- Behaviour changes ship with a regression test. Prefer seam and contract tests
  (route in, JSON out; generator with a mock model) over mocking internals.
- Tests must not depend on network, real AI providers, or wall-clock time.

## Architecture

- Shared schemas live in `shared`; the app and Worker import
  them rather than redefining shapes.
- Keep the generation seam `(prompt, model)` and the Blacklist untouched unless
  the issue explicitly changes them (ADR-0001).
- Avoid nested ternaries; prefer `if`/`else` or `switch`. Prefer explicit code
  over clever code.

## Commits

- Conventional commits (`feat(scope): …`, `fix(scope): …`, `chore(repo): …`),
  with the issue reference and any material decision in the body.
