# Package upgrade landscape for the Remix v3 migration

Research ticket: rymanacevedo/SCC#178 (map #174, feeds #185).
Snapshot date: 2026-10-12. "Current" is the range in the repo's `package.json`
files; "latest" is the npm `dist-tags.latest` fetched from
`https://registry.npmjs.org/<pkg>` on that date. `bun outdated` (Bun 1.4.2,
run in this worktree) agrees with the registry numbers quoted below.

How to read "forced by migration?":

- **dies** – the package exists only to serve React / React Router / Vite and
  has no other consumer in `packages/` (confirmed by grep, see section 5).
- **yes** – something upstream (Remix v3 peer/engine declarations, a wrangler
  peer bump, or the Zod unification the ticket asks for) requires the move.
- **no** – the bump is optional; it is listed so the dev can re-pin on current
  majors in one pass.

## Headline table

| package | where | current (package.json) | latest (npm, 2026-10-12) | forced by migration? | breaking notes |
| --- | --- | --- | --- | --- | --- |
| `remix` (target) | – | not installed | 3.0.0 (published 2026-10-01) | – | `engines.node >=24.3.0`; peers `pg`/`redis`/`mysql2`/`playwright` are all `optional: true`; no `zod`, `react`, `vite` or `tailwindcss` peer at all ([npm `remix@3.0.0`](https://registry.npmjs.org/remix/3.0.0)). UI comes from `remix/component`, not React; CSS comes from `css()`/`mix` in a native `rmx` cascade layer ([Rendering UI guide](https://guides.remix.run/rendering-ui/)). Serves via `router.fetch` on Node, Bun, Deno or a Cloudflare Worker `export default { fetch }` ([Request Handling guide](https://guides.remix.run/request-handling/)). |
| `zod` | frontend | `^3.25.76` | 4.6.7 | **yes** (unification; see section 1) | Method-form `.url()`, `.datetime()`, `.email()` and `ZodError.flatten()`/`.format()` are deprecated but still work; `error.errors` is removed; `.default()` semantics changed; `z.unknown()` keys must be present since 4.4.0 ([Zod 4 changelog](https://zod.dev/v4/changelog)). |
| `zod` | backend | `^4.4.3` | 4.6.7 | no | 4.4.0 ships "potentially breaking bug fixes" (tuple defaults, `z.undefined()` keys required, stricter `.merge()`); 4.5 adds `z.compile()`; 4.6 adds `.validate()` ([v4.4.0](https://github.com/colinhacks/zod/releases/tag/v4.4.0), [v4.5.0](https://github.com/colinhacks/zod/releases/tag/v4.5.0), [v4.6.0](https://github.com/colinhacks/zod/releases/tag/v4.6.0)). |
| `ai` | backend | `^6.0.209` | 7.0.138 (`ai-v6` tag: 6.0.304) | no | v7: ESM-only, Node >=22, `system` renamed `instructions`, `experimental_output` removed (SCC already uses `output: Output.object`), `stepCountIs` → `isStepCount`, telemetry moved to `@ai-sdk/otel`, codemod `npx @ai-sdk/codemod v7` ([migration guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0), [CHANGELOG 7.0.0](https://github.com/vercel/ai/blob/main/packages/ai/CHANGELOG.md)). `MockLanguageModelV3` is still exported from `ai/test` next to a new `MockLanguageModelV4` (verified in the published `ai@7.0.138/dist/test/index.d.ts`). **Blocked** by `evalite@1.0.0-beta.16` peer `ai: ^6` (section 2). |
| `@ai-sdk/openai` | backend | `^3.0.74` | 4.0.92 (`ai-v6` tag: 3.0.126) | no | 4.0.0: ESM-only, Node >=22; `openai.tools.customTool()` drops `name` (unused by SCC) ([CHANGELOG 4.0.0](https://github.com/vercel/ai/blob/main/packages/openai/CHANGELOG.md)). |
| `@ai-sdk/google` | backend (dev) | `3.0.88` (exact) | 4.0.94 | no | 4.0.0: "remove useless GenerativeAI affix from types and classes"; renamed exports keep deprecated aliases, `google` constant unchanged ([CHANGELOG 4.0.0](https://github.com/vercel/ai/blob/main/packages/google/CHANGELOG.md), migration guide). `evals/roster.ts` uses `createGoogleGenerativeAI` and would keep working via the alias. |
| `@hono/zod-validator` | backend | `^0.8.0` | 0.9.1 | no | 0.9.0 requires `hono >=4.11.2` (SCC has `^4.12.27`); peer `zod ^3.25.0 \|\| ^4.0.0`; no breaking change labelled ([CHANGELOG](https://github.com/honojs/middleware/blob/main/packages/zod-validator/CHANGELOG.md)). Remix v3 has no equivalent middleware; `remix/data-schema` `parse`/`parseSafe` "accept any Standard Schema v1 schema" including Zod ([data-schema README](https://github.com/remix-run/remix/blob/main/packages/data-schema/README.md)). |
| `hono` | backend | `^4.12.27` | 4.13.13 (`next`: 5.0.0-rc.1, 2026-10-10) | no | Minor bump only. v5 RC release body is empty; breaking list not confirmed. |
| `typescript` | root peer + frontend dev | `^6.0.3` | 7.0.2 (6.0.3 published 2026-04-16; 7.0 announced 2026-07-08) | no | TS 6.0 deprecations become hard errors in 7.0: `baseUrl`, `moduleResolution node/node10/classic`, `esModuleInterop:false`, `target es5`, `outFile`; defaults flip to `strict: true`, `module: esnext`, `types: []`; 7.0 "does not ship with an API" ([TS 6.0](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/), [TS 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)). SCC's tsconfigs already use `moduleResolution: Bundler` and `strict`; frontend sets `esModuleInterop: true` (fine). `types: []` default: root `tsconfig.json` has no `types` entry; backend/frontend do. |
| `bun` (packageManager) | root | `bun@1.2.2` (local CLI: 1.4.2) | 1.4.3 (2026-10-10) | no | Bun 1.3 (2025-10-10) made the isolated linker default **for new workspaces**, existing projects stay hoisted; `bun test` fails in CI on `test.only()`; default tsconfig `module: Preserve` ([Bun 1.3](https://bun.com/blog/bun-v1.3)). Bun 1.4 (2026-08-20): trusted-deps only from npm registry, SHA-512 in `bun.lock`, `bun test --parallel` implies `--isolate` ([Bun 1.4](https://bun.com/blog/bun-v1.4)). Bun's install/bunfig docs do not document `packageManager` or an `[install] workspaces` key (section 3). |
| `@biomejs/biome` | root dev | `2.5.1` (exact) | 2.5.15 | no | 2.5.1 → 2.5.15 are all "Patch Changes" ([CHANGELOG](https://github.com/biomejs/biome/blob/main/packages/@biomejs/biome/CHANGELOG.md)). `biome.json` `$schema` still points at 2.4.12. |
| `turbo` | root dev | `^2.10.0` | 2.11.7 | no | No release in 2.11.x labelled breaking ([releases](https://github.com/vercel/turborepo/releases)). Turbo parses `packageManager` strictly (`bun@<semver>`). |
| `wrangler` | backend dev | `^4.104.0` | 4.149.0 | no | No `### Major Changes` between 4.104.0 and 4.149.0 ([CHANGELOG](https://github.com/cloudflare/workers-sdk/blob/main/packages/wrangler/CHANGELOG.md)); peer moved from `@cloudflare/workers-types ^4.20260623.1` (4.104.0) to `^5.20261006.1` (4.149.0) (npm metadata). |
| `@cloudflare/workers-types` | backend dev | `^4.20260624.1` | 5.20261013.1 | **yes** (wrangler 4.149 peer) | v5 "exposes only the latest runtime types"; dated entrypoints removed; Cloudflare recommends `wrangler types` + `worker-configuration.d.ts` ([changelog 2026-07-03](https://developers.cloudflare.com/changelog/post/2026-07-03-workers-types-v5/), [TypeScript docs](https://developers.cloudflare.com/workers/languages/typescript/)). Backend `tsconfig.json` uses `"@cloudflare/workers-types/2023-07-01"`, which no longer exists in v5. |
| `evalite` | backend dev | `1.0.0-beta.16` | `latest` tag 0.19.0; `beta` tag 1.0.0-beta.16 (2026-02-20) | no | beta.16 peers: `ai: ^6`, `better-sqlite3: ^11.6.0`; deps `@vitest/runner ^4`, `@vitest/utils ^4` (npm). Upstream `main` is still 0.19.0, last commit 2025-11-10; "Support for AI SDK v7 in peerDependencies" is open ([#400](https://github.com/mattpocock/evalite/issues/400)). |
| `vitest` | backend dev | `4.1.9` (exact) | 5.0.4 (2026-09-03) | no | v5 requires Vite >=6.4 and Node >=22.12; `vite` is now a peer, not a dependency; `clearMocks` defaults to `true`; `sequential` removed ([migration](https://vitest.dev/guide/migration)). No file in `packages/` imports `vitest` directly (grep); evalite pulls `@vitest/runner` itself. |
| `lint-staged` | root | `^16.4.0` | 17.6.0 | no | 17.0.0: Node >=22.22.1, Git >=2.32; extensionless `.lintstagedrc` is now parsed as YAML with `yaml` optional ("If the content is JSON, consider renaming it to `.lintstagedrc.json`") ([v17.0.0](https://github.com/lint-staged/lint-staged/releases/tag/v17.0.0)). SCC's `.lintstagedrc` is JSON. |
| `husky` | root | `^9.1.7` | 9.1.7 | no | Already latest. |
| `@ai-hero/sandcastle` | root | `^0.10.0` | 0.12.0 | no | Not reviewed (no changelog consulted). |
| `@types/bun` | root/frontend/backend | `latest` / `^1.3.14` | 1.4.3 | no | Tracks Bun. |
| `@types/node` | frontend/backend | `^22.20.0` | 26.6.5 | **yes** once on Remix (Node >=24.3) | Pick the `@types/node` major matching the runtime Node; AI SDK 7 "recommends Node.js 24 (LTS) or 26" and notes Node 22 reached end-of-maintenance (migration guide). |
| `react`, `react-dom` | frontend | `^19.2.7` | 19.3.0 | **dies** | Only consumers are React components/tests under `app/` and `react-dom/server` in `ButtonLink.test.tsx`. |
| `react-router`, `@react-router/dev`, `@react-router/node`, `@react-router/serve` | frontend | `^8.0.1` | 8.4.0 | **dies** | Consumers: `vite.config.ts`, `react-router.config.ts`, `routes.ts`, `root.tsx`, route modules, `tsconfig.json` (`types`, `rootDirs`). |
| `@types/react`, `@types/react-dom` | frontend dev | `^19.2.17` / `^19.2.3` | 19.3.0 | **dies** | Type-only. |
| `@lexical/react` | frontend | `^0.25.0` | 0.52.0 | **dies** | Only consumer is `app/components/Editor.tsx` (React). Note 0.51 deprecates `LexicalComposer` for `LexicalExtensionComposer`. |
| `lexical`, `@lexical/rich-text` | frontend | `^0.25.0` | 0.52.0 | no (survivor) | 0.26: removed deprecated `@lexical/react` default exports; 0.49: built-in nodes moved to `$config()`, static `importJSON()`/`clone()` gone from built-ins, "node constructors require zero-argument defaults", `__type` readonly; 0.51: ESM-only; 0.52: HTML export honours `$createDOM` overrides, `getCommonAncestor` removed; peer `typescript >=5.2` ([releases](https://github.com/facebook/lexical/releases)). `CustomParagraphNode` overrides static `clone`/`importJSON` and calls `node.setFormat/setIndent/setDirection` – still allowed ("Custom nodes may keep their static methods") but the `$config()` port is "recommended". |
| `isbot` | frontend | `^5.1.44` | 5.2.2 | **dies** | Zero imports anywhere in `packages/` today (grep); it is a React Router SSR-template leftover and the app is `ssr: false`. |
| `vite` | frontend dev | `^8.1.0` | 8.3.4 | **dies** (unless kept only as a CSS build) | Consumers: `vite.config.ts`, `tsconfig.json` (`types: ["vite/client"]`), `biome.json` includes; `import.meta.env` in `root.tsx` and `lib/environment.ts`. Remix v3 tooling has no bundler step (section 4). |
| `@tailwindcss/vite` | frontend dev | `^4.3.1` | 4.3.3 | **dies** | Only consumer is `vite.config.ts`. |
| `@tailwindcss/postcss` | frontend dev | `^4.3.1` | 4.3.3 | no (candidate survivor) | Installed but unused today (no `postcss.config.*` in the repo). |
| `tailwindcss` | frontend dev | `^4.3.1` | 4.3.3 | no (survivor) | `app/app.css` uses `@import "tailwindcss"` and `@theme`. `tailwind.config.ts` (`module.exports = { content }`) is dead: v4 does not auto-detect JS configs ([upgrade guide](https://tailwindcss.com/docs/upgrade-guide)). |
| `autoprefixer` | frontend dev | `^10.5.2` | 10.6.1 | **dies** | v4 "imports and vendor prefixing is now handled for you automatically, so you can remove `postcss-import` and `autoprefixer`" (upgrade guide). No consumer in the repo. |
| `react-scan` (CDN `<script>` in `root.tsx`) | frontend | 0.5.7 via unpkg | 0.5.7 | **dies** | React devtool; the `Layout` component that injects it dies with React Router. |
| `docx` | frontend | `^9.7.1` | 9.10.0 | no (survivor) | 9.8.1 removed empty `WORKAROUND2/3/4` exports; 9.9.0 now throws "for a drawing too big for Word to open"; 9.8.0 changed percentage table-width emission ([releases](https://github.com/dolanmiu/docx/releases)). SCC uses `Document`, `Packer.toBlob`, `Paragraph`, `TextRun`, `HeadingLevel`, `AlignmentType` – none mentioned as changed. |
| `jspdf` | frontend | `^4.2.1` | 4.2.1 (2026-03-17) | no (survivor) | Already latest. |
| `file-saver` | frontend | `^2.0.5` | 2.0.5 (published 2020-11-19) | no (survivor) | No release in ~6 years; `declarations.d.ts` shims its types. |
| `dompurify` | frontend | `^3.4.11` | 3.4.17 (2026-10-12) | no (survivor) | 3.4.12–3.4.17 are hardening/patch releases; 3.4.16 "Fixed a problem with ESM default exports landing in CommonJS declarations" ([releases](https://github.com/cure53/DOMPurify/releases)). SCC calls `DOMPurify.sanitize(text, { ALLOWED_TAGS: [] })`. |
| `bad-words` | frontend | `^4.0.0` | 4.1.5 | no (survivor) | 4.1.0 adds a tagged-template helper and fixes the CJS build; no breaking change after 4.0.0 ([CHANGELOG](https://github.com/nyvorin/badwords/blob/main/CHANGELOG.md)). Ships its own `dist/index.d.ts` (npm). |
| `@types/bad-words` | frontend dev | `^3.0.3` | 4.0.0 (**deprecated stub**) | drop | npm deprecation text: "bad-words provides its own type definitions, so you do not need this installed." |
| `@scc/frontend` | backend dep | `1.0.0` | workspace | ? | Backend declares the frontend workspace as a runtime dependency; no backend file imports it (grep). Looks vestigial. |

## 1. Zod unification path

### Where SCC stands today

- Frontend: `zod ^3.25.76`; 19 files import `zod`. Backend: `zod ^4.4.3`; 4 files.
  `packages/shared/errorReporting.ts` imports `zod` and is consumed by
  `packages/backend/src/index.ts` (via `services/github.ts`),
  `packages/frontend/app/routes/api/errors.tsx`, `.../api/report-issue.tsx`
  and `.../utils/errorTelemetry.ts`.
- `bun.lock` resolves the hoisted root `zod` to **4.4.3** and nests
  `@scc/frontend/zod` → **3.25.76**. `packages/shared/` has no `package.json`,
  so Node-style resolution from `packages/shared/errorReporting.ts` walks up to
  the root `node_modules` and lands on Zod **4**, while the frontend route code
  that wraps it (`error instanceof z.ZodError` in `api/errors.tsx` and
  `api/report-issue.tsx`) imports `z` from the frontend's Zod **3** copy.
  I could not run `bun install` in this worktree to prove it end to end, but
  the lockfile layout means those `instanceof` checks compare an error from one
  Zod copy against the class of another and should be tested before trusting
  the 400 path (section 7).
- Zod 3.25.76 already ships the `./v4`, `./v4/core`, `./v4/mini` subpaths
  (npm `exports`), so `import { z } from 'zod/v4'` is a valid intermediate
  step on the frontend without changing the installed version.

### What the ecosystem requires

- `ai`, `@ai-sdk/openai`, `@ai-sdk/google` (6.x and 7.x alike) declare
  `zod: ^3.25.76 || ^4.1.8` (npm). Note the v4 floor is **4.1.8**, so a Zod 4
  unification must land ≥4.1.8; `^4.4.3` already does.
- `@hono/zod-validator` 0.8.0 and 0.9.1 declare `zod: ^3.25.0 || ^4.0.0` (npm).
- Remix v3 declares no Zod peer. `remix/data-schema` is "Standard Schema v1
  compatible" and "`parse` and `parseSafe` accept any Standard Schema v1
  schema, not just data-schema's own schemas. You can pass a Zod, Valibot, or
  ArkType schema and they'll work" ([README](https://github.com/remix-run/remix/blob/main/packages/data-schema/README.md)).
  Zod 4.6.7 exposes `"~standard": StandardSchemaV1.Props` on every schema
  (`zod@4.6.7/v4/core/core.d.ts`), and Zod 3.25.76 ships
  `v3/standard-schema.d.ts`. So whichever validator replaces
  `@hono/zod-validator`, the Zod schemas can be handed to Remix directly.
- Remix's own form-error pattern is `parsed.issues.find(issue => issue.path?.[0] === name)`
  ([Forms and Mutations guide](https://guides.remix.run/forms-and-mutations/)):
  there is no `flatten()`/`fieldErrors` helper on the Remix side; the
  `FormErrors` shape SCC builds from `fieldErrors` will need an adapter either
  way.

### Zod 4 deltas that touch SCC code (from the [Zod 4 changelog](https://zod.dev/v4/changelog) and source)

| SCC usage | Files | Zod 4 status |
| --- | --- | --- |
| `z.string().url()` | `shared/errorReporting.ts`, `backend/lib/environment.ts` (×2), `frontend/app/lib/environment.ts` | Method deprecated: "/** @deprecated Use `z.url()` instead. */" in `v4/classic/schemas.ts`. `z.url()` trims, validates with `new URL()`, and "is quite permissive" (accepts `mailto:`); `z.httpUrl()` restricts to http/https ([API docs](https://zod.dev/api)). Behaviour for the env URLs SCC validates is not expected to change; Zod 3's exact acceptance set was not re-verified. |
| `z.string().datetime()` | `shared/errorReporting.ts` (×2) | Deprecated in favour of `z.iso.datetime()`. Default "accepts a strict subset of ISO 8601; by default, no timezone offsets are allowed", seconds required, `Z` suffix only (API docs). SCC produces the value with `new Date().toISOString()` (`utils/errorTelemetry.ts`), which satisfies the default; the `report-issue.tsx` form field is whatever the client posted, so keep the same strictness or add `{ offset: true }` deliberately. |
| `error.flatten().fieldErrors` | 10 frontend route modules + `experience.test.ts`; `error.flatten()` in `api/errors.tsx` | `ZodError.flatten()` is "@deprecated Use the `z.treeifyError(err)` function instead" but still installed lazily (`v4/classic/errors.ts`). Shallow equivalent: `z.flattenError(err)` returns `{ formErrors, fieldErrors }` ([error formatting](https://zod.dev/error-formatting)). |
| `error instanceof z.ZodError` | 12 files | `parse()` throws `ZodRealError`, constructed with `Parent: Error` under the name `"ZodError"` (`v4/classic/parse.ts`, `errors.ts`), so both `instanceof z.ZodError` and `instanceof Error` hold **when both sides are the same Zod copy**. Zod Mini's `$ZodError` "does not extend the built-in `Error` class" ([core docs](https://zod.dev/packages/core)); classic is unaffected. `error.errors` alias is removed (SCC does not use it; grep). `.issues` is now a non-enumerable property. |
| `z.infer`, `schema.shape`, `z.ZodRawShape` / `z.ZodObject<T>` | `utils/getFieldNames.ts`, `backend/lib/environment.ts`, type exports | `z.infer` unchanged. Backend's `parseEnvironment<T extends z.ZodRawShape>(schema: z.ZodObject<T>)` already compiles on 4.4.3; the frontend `getFieldNames` has the same shape. Changelog: `ZodType` generics are now `<Output, Input>`; `ZodTypeAny` no longer needed. |
| `.default()` | `schemas/experience.ts` (`currentlyEmployed`), `schemas/education.ts` (`degree`, `location`, `currentlyEnrolled`) | "The default value must be assignable to the output type" and defaults short-circuit on `undefined` input; "Defaults inside your properties are applied, even within optional fields". `BaseEducationSchema.partial()` (`utils/user.ts`) may therefore now emit `''`/`false` for absent keys where Zod 3 omitted them. Use `.prefault()` to keep Zod 3 semantics. |
| `.transform()` chains then `.refine()` | `schemas/experience.ts`, `schemas/education.ts`, `builder/info.tsx` | `.transform()` now returns `ZodPipe` (changelog "adds `ZodTransform`"); chaining continues to work. Refinement type predicates no longer narrow. |
| `.superRefine((v, ctx) => ctx.addIssue(...))` | `builder/education.tsx` | `ctx.addIssue` still exists; `ctx.path` was dropped (not used by SCC). |
| `z.union([z.literal(...)])`, `.min/.max/.regex/.trim/.optional/.describe/.email` | many | `z.string().email()` deprecated for `z.email()`; the rest unchanged. |

### Recommendation

1. Bump the frontend to `zod@^4.6.7` **before** the Remix rewrite, as its own
   PR, and pin the same range in all three places (or a Bun catalog). This
   removes the two-copies hazard around `packages/shared`, and every consumer
   (`ai` 6/7, `@hono/zod-validator`, Remix `data-schema`) already accepts
   Zod 4 ≥4.1.8.
2. In the same PR, move `packages/shared/errorReporting.ts` to top-level
   `z.url()` / `z.iso.datetime()` and replace `error.flatten().fieldErrors`
   with a single shared helper over `z.flattenError(err)` (or over
   `err.issues` + `path`, which is also what Remix's form guide expects), so
   the 10 route modules stop duplicating the catch block.
3. Keep the `instanceof z.ZodError` checks; they are correct once both sides
   share one Zod copy. Prefer `safeParse` where the catch exists only to
   branch on ZodError.
4. Audit `.partial()` + `.default()` output for `education` entries in
   `sessionStorage` (user.ts) after the bump.

## 2. AI SDK

- Majors today: `ai` 7.0.138, `@ai-sdk/openai` 4.0.92, `@ai-sdk/google`
  4.0.94, `@ai-sdk/provider` 4.0.27; the 6.x line is still published under
  the `ai-v6` tag (6.0.304 / 3.0.126 / 3.0.131) (npm dist-tags).
- Breaking changes since 6.0.209 that matter to `src/services/ai.ts`,
  `model.ts`, `evals/roster.ts`, `ai.test.ts`:
  - 7.0.0 "Remove CommonJS exports from all packages. All packages are now
    ESM-only" and "Raise minimum supported Node.js version to 22. Supported
    versions: 22, 24, and 26." (ai CHANGELOG 7.0.0). The backend package has
    `"type": "module"` at the root; wrangler bundles ESM, so no change.
  - "The top-level `system` option was renamed to `instructions`, and `system`
    remains as a deprecated fallback" (migration guide). All three generators
    in `ai.ts` pass `system`.
  - "The deprecated `experimental_output` option has been removed in AI SDK 7"
    – SCC already uses `output: Output.object({ schema })` and reads
    `result.output`, so no change.
  - `system` messages inside `messages`/`prompt` are rejected by default
    (7.0.0 "4e095b0"); SCC passes a string `prompt`, unaffected.
  - Telemetry moved to `@ai-sdk/otel`; `@opentelemetry/api` is no longer a
    dependency of `ai@7` (npm `dependencies`) – `evalite`'s `wrapAISDKModel`
    tracing is unrelated to this.
- `MockLanguageModelV3` **remains** the test double: `ai@7.0.138/dist/test/index.d.ts`
  declares both `MockLanguageModelV3 implements LanguageModelV3` and
  `MockLanguageModelV4`, and `ai@7`'s `type LanguageModel = GlobalProviderModelId | LanguageModelV4 | LanguageModelV3 | LanguageModelV2`
  (`dist/index.d.ts` line 115). The `doGenerate` result shape in
  `ai.test.ts` (`content`, `finishReason: { unified, raw }`,
  `usage.inputTokens.{total,noCache,cacheRead,cacheWrite}`) is the V3 shape
  and keeps compiling. No changelog entry deprecates `MockLanguageModelV3`;
  only decision-model mocks carry `@deprecated` in the file.
- Workers compatibility: the SDK is runtime-agnostic (`engines.node` only
  governs Node). Evidence it is exercised on Workers: 7.0.96 "fix(ai): call
  `atob` without a receiver for Cloudflare Workers compatibility" (ai
  CHANGELOG). No official "supported runtimes" statement was found
  (section 7).
- `@ai-sdk/google` 4.0.0 renames `GoogleGenerativeAI*` symbols to `Google*`;
  "For all externally exported symbols that were renamed, the old names
  continue to work via deprecated aliases" (google CHANGELOG 4.0.0,
  "04e9009"). `createGoogleGenerativeAI` in `evals/roster.ts` keeps working.
- **Blocker:** `evalite@1.0.0-beta.16` (the pinned version) declares peer
  `ai: ^6` (npm). The project's `latest` tag is 0.19.0, `main` is at 0.19.0
  with its last commit on 2025-11-10, and
  [mattpocock/evalite#400](https://github.com/mattpocock/evalite/issues/400)
  "Support for AI SDK v7 in peerDependencies" is open. Moving `ai` to 7
  means either overriding the peer, dropping `evalite`, or waiting.

## 3. Toolchain

- **TypeScript.** Latest `typescript` is 7.0.2 (Go-native; "it does not ship
  with an API"; `@typescript/typescript6` provides `tsc6` for tools that need
  the 6.0 API). Remix v3 expects "`tsc --noEmit` as a separate typecheck"
  and a tsconfig with `NodeNext`, `.ts` extensions in relative imports, and
  `jsx: react-jsx` + `jsxImportSource: remix/component`
  ([CLI and Tooling guide](https://guides.remix.run/cli-and-tooling/)).
  Current SCC tsconfigs use `moduleResolution: Bundler`; `react-router typegen`
  and `rootDirs: [".", "./.react-router/types"]` die with React Router.
  Nothing in the repo consumes the TypeScript programmatic API (Biome and Bun
  do not), so TS 7 is not blocked.
- **Bun.** `packageManager` is pinned to `bun@1.2.2` while the local CLI is
  1.4.2 and latest is 1.4.3. I found no statement in Bun's
  [`bun install`](https://bun.com/docs/pm/cli/install) or
  [bunfig](https://bun.com/docs/runtime/bunfig) docs that Bun reads or
  enforces `packageManager`; Turbo does parse it (Turbo's
  `invalid_package_manager_field` error, oven-sh/bun#13031). The documented
  `[install]` keys are `linker`, `linkWorkspacePackages`, `saveTextLockfile`,
  `exact`, etc.; the repo's `bunfig.toml` `[install] workspaces = true` is not
  among them.
- **Biome.** 2.5.1 → 2.5.15 is patch-only; `biome.json` `$schema` is pinned to
  2.4.12 and should follow the installed version. Remix's `rmx` layer /
  `css()` strings may need the CSS linter scope revisited, but no rule
  changes in 2.5.x affect SCC's config (`noConsole`, `noExplicitAny`,
  `noArrayIndexKey`, `noLabelWithoutControl` all unchanged in the range).
- **Turbo.** 2.11.7; no breaking changes labelled since 2.10. `turbo.json`
  `build.outputs: ["dist/client/**"]` is React Router's layout and will need
  to match the Remix app's output (Remix has no bundle step by default).
- **wrangler / workers-types.** wrangler 4.149.0 (Node >=22) is a straight
  bump, but its peer now demands `@cloudflare/workers-types ^5`. v5 removes
  the dated entrypoints, so `"types": ["@cloudflare/workers-types/2023-07-01", "node", "bun"]`
  in `packages/backend/tsconfig.json` must become either the bare package
  (latest runtime) or, as Cloudflare recommends, `wrangler types` →
  `"types": ["./worker-configuration.d.ts", "node"]`.
- **evalite / vitest.** `vitest@4.1.9` is a devDependency with no direct
  import; evalite beta.16 depends on `@vitest/runner ^4`, so vitest 5
  (vite becomes a peer; Node >=22.12) brings nothing until evalite moves.
  evalite 0.17.0 "Upgraded to Vitest v4"; 0.16.0 "Added `evalite.config.ts`"
  ([releases](https://github.com/mattpocock/evalite/releases)).
- **lint-staged / husky.** husky is current. lint-staged 17 needs
  Node >=22.22.1 and parses extensionless `.lintstagedrc` as YAML; rename to
  `.lintstagedrc.json` when bumping.

## 4. Tailwind 4 without Vite

- `tailwindcss` 4.3.3 is current (4.3.1 in repo). Three supported build
  paths, none of which need Vite:
  - **CLI**: `npm install tailwindcss @tailwindcss/cli`, then
    `npx @tailwindcss/cli -i ./src/input.css -o ./src/output.css --watch`;
    also "available as a standalone executable"
    ([Tailwind CLI](https://tailwindcss.com/docs/installation/tailwind-cli)).
    `@tailwindcss/cli` latest is 4.3.3 (npm).
  - **PostCSS**: `npm install tailwindcss @tailwindcss/postcss postcss` with
    `plugins: { "@tailwindcss/postcss": {} }`
    ([Using PostCSS](https://tailwindcss.com/docs/installation/using-postcss)).
    `@tailwindcss/postcss` is already in the frontend devDependencies.
  - Vite plugin (`@tailwindcss/vite`) – dies with Vite.
- v4 handles `@import` and vendor prefixing itself, so `autoprefixer` goes
  ([upgrade guide](https://tailwindcss.com/docs/upgrade-guide)). The legacy
  `tailwind.config.ts` is ignored unless loaded with `@config`; v4 uses
  automatic source detection / `@source`.
- Remix v3 ships no Tailwind integration (`@remix-run/tailwind` does not
  exist on npm; the Rendering UI guide only documents `css()`/`mix`, a native
  `rmx` cascade layer, and `<style data-rmx-style>` injection). Apps that
  own other layers "should declare the full order once, as in
  `@layer base, rmx, app;`" – Tailwind's own `@layer` names will need to be
  reconciled with `rmx`. The CLI (`--watch` in dev, one-shot in build) writing
  a static stylesheet into a `public/` directory, linked from the document
  shell, is the path that matches Remix's "global stylesheets in `<head>`"
  model ([Rendering UI guide](https://guides.remix.run/rendering-ui/)).
- Browser floor: "Safari 16.4+, Chrome 111+, and Firefox 128+" (upgrade
  guide) – unchanged by the migration.

## 5. Packages that die with React / React Router (consumer grep)

Grep ran over `packages/` excluding `node_modules`, `dist`, `build`,
`.react-router`:

| package | consumers found |
| --- | --- |
| `react` | 22 files import `react` (all under `packages/frontend/app`). |
| `react-dom` | `app/components/ButtonLink.test.tsx` (`react-dom/server`). |
| `react-router`, `@react-router/*` | `vite.config.ts`, `react-router.config.ts`, `tsconfig.json`, `app/routes.ts`, `root.tsx`, 15 route/component files. |
| `@lexical/react` | `app/components/Editor.tsx` only. |
| `isbot` | none. |
| `vite` | `vite.config.ts`, `tsconfig.json` (`vite/client`), `biome.json`; `import.meta.env` in `root.tsx`, `lib/environment.ts`. |
| `@tailwindcss/vite` | `vite.config.ts` only. |
| `autoprefixer`, `@tailwindcss/postcss` | none (no PostCSS config exists). |
| `@types/react*` | type-only. |
| `react-scan` | `root.tsx` dev-only `<script src="https://unpkg.com/react-scan@0.5.7/dist/auto.global.js">`. |

Survivors and their consumers: `lexical` (`Editor.tsx`, `utils/editor/functions.ts`,
`utils/editor/custom/CustomParagraphNode.ts`), `@lexical/rich-text`
(`Editor.tsx`, `functions.ts`), `docx` (`functions.ts`, `word/addParts.ts`,
`declarations.d.ts`), `jspdf` (`functions.ts`, `pdf/addParts.ts`),
`file-saver` (`functions.ts`, `word/addParts.ts`, `declarations.d.ts`),
`dompurify` (`functions.ts`), `bad-words` (`utils/filter.ts`,
`routes/api/experienceEntry.tsx`).

Caveat on Lexical: `lexical` core is framework-agnostic, but SCC only drives
it through `@lexical/react` (`LexicalComposer`, `RichTextPlugin`,
`ContentEditable`, `HistoryPlugin`, `AutoFocusPlugin`, `LexicalErrorBoundary`).
Whether the core survives depends on the UI-model research (#174) choosing to
re-host the editor on `remix/component`; `functions.ts` also uses Lexical
only to build a document tree before export.

## 6. Survivors to re-pin

See the table rows for `docx`, `jspdf`, `file-saver`, `dompurify`,
`bad-words`, `lexical`. Additional notes:

- `declarations.d.ts` declares `docx` and `file-saver` as untyped modules;
  `docx` publishes its own types, so the shim hides them (not verified
  whether removing it compiles).
- `@types/bad-words@4.0.0` is a deprecated stub; `bad-words@4.1.5` ships
  `dist/index.d.ts` and ESM/CJS `exports` (npm). Remove the `@types` package.
- `file-saver` has not been released since 2020-11-19; a native
  `URL.createObjectURL` + `<a download>` is a drop-in if the dependency is to
  be retired (not evaluated here).

## 7. Open questions / unverified

- **Two Zod copies at runtime.** Inferred from `bun.lock` (root `zod@4.4.3`,
  `@scc/frontend/zod@3.25.76`) and Node resolution rules; not executed. A
  test posting an invalid body to `/api/errors` would confirm whether the
  `instanceof z.ZodError` branch currently fires.
- **Bun and `packageManager`.** No official statement found either way; the
  1.3/1.4 blog posts and install/bunfig docs do not mention the field.
- **Remix v3 on Cloudflare Workers.** The Request Handling guide shows the
  `export default { fetch }` adapter and warns that the static-file and
  compression middleware "use Node filesystem and compression APIs"; no
  Workers-specific deployment guide, `workerd` compatibility matrix, or
  `nodejs_compat` requirement was found. Remix's `engines.node >=24.3.0` is
  about the Node runtime only.
- **Remix v3 Node version vs. Bun.** The guides never name a Node version or
  Bun support beyond the `Bun.serve` snippet; the only hard number is the
  npm `engines` field.
- **AI SDK 7 on Workers.** Only indirect evidence (the 7.0.96 `atob` fix and
  the `workers-ai-provider` community provider page). No official runtime
  support matrix.
- **Hono 5.** `5.0.0-rc.1` exists under the `next` tag (2026-10-10) with an
  empty GitHub release body; its breaking list was not obtained. Only
  relevant if Hono survives the migration (not this ticket's call).
- **Zod 3 `.url()` acceptance set** was not re-verified, so "no behaviour
  change for SCC's URLs" is an expectation, not a measurement.
- **Lexical 0.36–0.42 / 0.44 breaking sections** were read via the releases
  listing; 0.45+ and ≤0.35 via the GitHub API. Nothing in them names
  `ParagraphNode.importJSON`, `$createHeadingNode`, or
  `$generateHtmlFromNodes` explicitly, but the 0.49 `$config()` port and the
  0.52 HTML-export change are the two that touch `CustomParagraphNode` and
  the HTML export path in `functions.ts` and should be tested, not assumed.
- `@ai-hero/sandcastle` 0.10 → 0.12 and `@types/node` 22 → 26 changelogs were
  not reviewed.
- Nothing here was executed against an installed tree: `bun install`,
  `bun run dev`, and `bun test` were not run.
