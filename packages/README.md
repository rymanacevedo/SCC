# Packages

Each folder here is a **deep module**: much behaviour behind a small interface. Enforced by `bun run lint:boundaries` (dependency-cruiser, `.dependency-cruiser.cjs`), which cruises `app`, `worker`, `shared`, `packages`, `build`, `test`, `e2e` and `evals`, and runs in `bun run check`, CI and the pre-commit hook.

## Layout

```
packages/
  <name>/
    index.ts     ← entry point (public)
    client.ts    ← another entry point; a package may expose several
    lib/         ← implementation (private)
    tests/       ← co-located Bun tests + fixtures (private)
```

Root files = entry points. Any subfolder = private; `lib/` and `tests/` are convention, not hardcoded. Packages are flat: no package inside a package.

Copy `example/` to start a new package. Delete `example/` once real packages exist.

```ts
import { formatGreeting } from '../packages/example/index.ts'; // ok
import { buildGreeting } from '../packages/example/lib/greeting.ts'; // error
```

Import by relative path with the `.ts` extension (NodeNext); there is no `packages/*` tsconfig alias. Both `tsconfig.json` (app) and `tsconfig.worker.json` include `packages/`, so a package must typecheck under both: keep DOM-only or Worker-only globals out of code the other runtime compiles.

## Rules

**Entry-point boundary.** Code outside a package (app, Worker, shared code or another package) imports only its root files, never its subfolders. Type-only imports count. Rules: `entrypoint-boundary-from-app`, `entrypoint-boundary-across-packages`.

**Intra-package freedom.** A package's own files import each other freely.

**Tests through entry points.** Files in `<name>/tests/` import any package's entry points and their own `tests/` fixtures, never subfolder internals, not even their own package's. Nothing outside `tests/` imports from `tests/`. Rules: `tests-through-entrypoints`, `tests-folder-is-private`.

**No cycles.** No dependency cycles anywhere in the cruised roots. Rule: `no-circular`.

## No barrel files

Do not re-export a whole subtree through one `index.ts`. Expose several small entry points (`index.ts`, `client.ts`, `server.ts`), each exporting only what callers need, and keep the rest in `lib/`.

## Tooling

The repo is on TypeScript 7, which dependency-cruiser's default parser does not support, so the config parses with SWC (`@swc/core`, `parser: 'swc'`) and does not read `tsconfig.json`. Imports that do not resolve to a file are not checked by these rules.
