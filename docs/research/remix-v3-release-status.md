# Remix v3 release status, package set, and production-readiness (as of 2026-10-12)

Research note for wayfinder ticket #175 (map #174). Gate fact for "Confirm the destination" (#181); feeds #181 and #185.

All claims below are from primary sources only: the `remix-run/remix` GitHub repository (releases, tags, changelogs, READMEs, source), remix.run / guides.remix.run / api.remix.run, the Remix blog, and npm registry metadata. Registry timestamps are UTC. Where a claim could not be confirmed from a primary source it is listed under "Open questions / unverified" rather than asserted.

## Summary

1. **Stable shipped.** `remix@3.0.0` was published to npm on 2026-10-01 22:58 UTC (the evening before Remix Jam, 2026-10-02) and is the `latest` dist-tag; the GitHub release `remix@3.0.0` (not marked prerelease) says "First stable release of Remix 3." The RC line ran `3.0.0-rc.1` (2026-08-31) through `rc.5` (2026-10-01). Still unstable: `@remix-run/ui` (0.12.1, "currently unstable and versioned independently", not in the `remix` package). A `Release v3.1.0` PR (#11978, opened 2026-10-07) is open but unpublished. No stable-release blog post exists yet; the newest post is the 2026-08-31 RC announcement.
2. **Package set.** A new app installs one runtime dependency, `remix@3.0.0`, which re-exports 49 `@remix-run/*` packages, all at `1.0.0` (except `@remix-run/lazy-file@5.0.8`), via subpaths such as `remix/router` + `remix/routes` (fetch-router), `remix/component` (component runtime + JSX), `remix/spa`, `remix/headers`, `remix/form-data-parser`, `remix/session`, `remix/middleware/*`, `remix/assets`, `remix/node-fetch-server`, `remix/cli`. `remix/ui` and `@remix-run/dom` are superseded names: the component runtime moved `@remix-run/dom` (experimental, 2025) -> `@remix-run/ui` (beta, 2026) -> `@remix-run/component@1.0.0`. Only `@remix-run/ui@0.12.1` (headless primitives + animation) remains v0.x and must be installed separately.
3. **Runtime.** `engines.node >= 24.3.0` (package, template, and CLI constant). No bundler and no build step: the starter runs `node --import remix/node-tsx server.ts` in dev and prod, with `remix/assets` compiling browser modules on demand (oxc + lightningcss). Bun, Deno, and Cloudflare Workers are documented as supported for the Fetch-handler server side (`router.fetch`), but the dev/HMR/TS-loader/asset tooling is Node-specific. No TypeScript floor is published; `remix new` writes `typescript: "latest"`, the monorepo pins `typescript ^7.0.2`, and the generated tsconfig needs modern options (`rewriteRelativeImportExtensions`, `jsxImportSource: "remix/component"`).
4. **Not React.** Official statements: "Remix components use JSX, but they are not React" (repo agent skill); "no critical dependencies, not even React ... building our own component model" (Wake up, Remix!); "Remix 3 would not be built on React" (Jam 2025 recap). The component model is `@remix-run/component`: a setup function receives a `Handle`, returns a render function, keeps state in closures, and calls `handle.update()`; composition is via `mix`/`on`/`css` mixins and `Frame`. The 2025 "fork of Preact" starting point is not visible in the shipped package (zero runtime deps; only a DOM typings file is "Adapted from Preact"). The only React interop the team mentions is swapping the `render` middleware for a React-based one; no first-party React adapter exists in the repo.
5. **Stability policy.** The RC post commits to "start binding ourselves to SemVer"; every package changelog states it "follows semantic versioning"; CONTRIBUTING defines `major` = breaking change for stable packages and `minor` = features *and* breaking changes for v0.x packages; SECURITY.md supports `3.x` only. There is no LTS policy, no published breaking-change cadence, and no deprecation window. Cadence is fast (weekly-ish releases during beta; a 3.1.0 minor queued six days after 3.0.0). Several guide chapters are explicitly unfinished.

## 1. Release state: did the Remix Jam stable release ship?

**Yes. `remix@3.0.0` is published and is `latest`.**

- npm `dist-tags` for `remix`: `latest: 3.0.0`, `next: 3.0.0-rc.5`. `time["3.0.0"] = 2026-10-01T22:58:11.740Z`. Source: https://registry.npmjs.org/remix (`curl -s https://registry.npmjs.org/remix | jq '."dist-tags", .time["3.0.0"]'`).
- GitHub release `remix@3.0.0`, published 2026-10-01T23:08:29Z, `prerelease: false`, body: "First stable release of Remix 3." https://github.com/remix-run/remix/releases/tag/remix@3.0.0
- Release PRs: #11952 "Prepare Remix 3 stable release" and #11954 "Release v3.0.0" (merged 2026-10-01T22:35Z), #11957 "Update install instructions for the stable Remix release". https://github.com/remix-run/remix/pull/11954
- The RC blog post (2026-08-31) said "we'll release Remix 3 on October 2 at Remix Jam" and introduced `3.0.0-rc.1`. https://remix.run/blog/remix-3-release-candidate
- Remix Jam 2026 is 2026-10-02 at Shopify's Toronto office (EDT). The 3.0.0 npm publish at 22:58 UTC on 2026-10-01 is 18:58 EDT, the evening before. The Jam page itself does not announce a release. https://remix.run/jam/2026
- The blog index has no post for the stable release; the most recent post is "Remix 3 Release Candidate" (Aug 31, 2026). https://remix.run/blog

**Prerelease timeline for `remix` (npm `time`, UTC):**

| Version | Published |
| --- | --- |
| 3.0.0-alpha.0 | 2026-01-20 |
| 3.0.0-beta.0 | 2026-04-30 (blog: "Remix 3 Beta Preview", "not production ready yet") |
| 3.0.0-beta.10 | 2026-08-17 |
| 3.0.0-rc.1 | 2026-08-31 (secondary claim confirmed) |
| 3.0.0-rc.2 .. rc.4 | 2026-09-08, 09-18, 09-28 |
| 3.0.0-rc.5 | 2026-10-01 17:10 |
| **3.0.0** | **2026-10-01 22:58** |

Sources: https://registry.npmjs.org/remix ; https://remix.run/blog/remix-3-beta-preview ; `packages/remix/CHANGELOG.md` sections `v3.0.0-alpha.0` .. `v3.0.0` at https://github.com/remix-run/remix/blob/main/packages/remix/CHANGELOG.md

**What is still RC/beta/experimental/unstable:**

- `@remix-run/ui@0.12.1` (published 2026-10-01T22:58:37Z). Its README: "`@remix-run/ui` is currently unstable and versioned independently. It is not available through the `remix` package." The `remix@3.0.0` release notes: "This package is currently unstable, versioned independently in the v0.x range, and not part of the Remix 3.0 release candidate." Sources: https://github.com/remix-run/remix/blob/main/packages/ui/README.md ; https://github.com/remix-run/remix/releases/tag/remix@3.0.0 ; https://registry.npmjs.org/@remix-run/ui
- `@remix-run/dom` (`latest: 0.0.0-experimental-remix-jam.1`, `jam: 0.0.0-experimental-remix-jam.6`, last published 2026-02-12). Not deprecated on npm, but superseded (see section 2). https://registry.npmjs.org/@remix-run/dom
- `@remix-run/interaction@0.5.0` (last published 2026-01-28): not a dependency of `remix@3.0.0`; status unknown (see open questions). https://registry.npmjs.org/@remix-run/interaction
- Stale legacy dist-tags on `remix` (`nightly` 0.0.0-nightly-...-20250722, `experimental`, `pre: 2.17.0-pre.1`) belong to the Remix 1/2 line, as does `@remix-run/dev@2.17.5`. They are not part of v3. https://registry.npmjs.org/remix ; https://registry.npmjs.org/@remix-run/dev

**What is next:** PR #11978 "Release v3.1.0" (opened 2026-10-07, open, automated by the `release-pr` workflow) bumps `remix` 3.0.0 -> 3.1.0, `@remix-run/component` 1.0.0 -> 1.1.0 (frame reload options, focus-reset controls), plus patches to `assets`, `cli`, `render-middleware`, `spa`, and `ui` 0.12.2. As of 2026-10-12, npm `latest` is still 3.0.0 (registry `modified: 2026-10-01T22:58:12Z`). https://github.com/remix-run/remix/pull/11978

## 2. Exact package set, roles, versions, stability

**Install surface:** `npm i remix` (or `npx remix new my-remix-app`). Root README: "Remix will be distributed as a single `remix` package for both distribution and documentation" and "all packages that make up Remix should be usable standalone as well." The Start Here guide: "For most web apps, `remix` can be the only runtime dependency in `package.json`." Sources: https://github.com/remix-run/remix/blob/main/README.md ; https://github.com/remix-run/remix/blob/main/packages/remix/guides/01-start-here.md

**`remix@3.0.0` manifest** (https://registry.npmjs.org/remix/3.0.0): `engines.node: ">=24.3.0"`, `bin: { remix }`, `license: MIT`, 49 `dependencies` all `@remix-run/*@^1.0.0` except `@remix-run/lazy-file@^5.0.8`; `peerDependencies` (only needed for the matching adapter): `pg ^8.16.3`, `redis ^5.10.0`, `mysql2 ^3.15.3`, `playwright ^1.60.0`.

**Subpath -> package map** (from `exports` of `remix@3.0.0` and `packages/remix/INDEX.md`, https://github.com/remix-run/remix/blob/main/packages/remix/INDEX.md). Every listed package is `1.0.0`, published 2026-10-01 (npm), with a matching GitHub release tagged `<name>@1.0.0`, unless noted.

| `remix/*` subpath(s) | Package | Role (package description) |
| --- | --- | --- |
| `remix/router`, `remix/routes` | `@remix-run/fetch-router` | Minimal, composable router for the web Fetch API (routes, controllers, middleware) |
| `remix/route-pattern` (+ `/href`, `/join`, `/match`, `/specificity`) | `@remix-run/route-pattern` | Match and generate URLs with strong typing |
| `remix/component` (+ `/server`, `/test`, `/jsx-runtime`, `/jsx-dev-runtime`, `/dev/refresh`) | `@remix-run/component` | Component runtime with server rendering and browser hydration; JSX runtime |
| `remix/component-hmr` (+ `/assets`, `/node`, `/runtime/*`) | `@remix-run/component-hmr` | HMR runtime and transforms for Remix components |
| `remix/spa` | `@remix-run/spa` | Client-rendered application routing (fetch router in the browser + component runtime) |
| `remix/middleware/render` | `@remix-run/render-middleware` | Conventional component `render()` middleware |
| `remix/headers` (+ 15 header subpaths) | `@remix-run/headers` | Typed HTTP header toolkit |
| `remix/cookie` | `@remix-run/cookie` | Cookie toolkit |
| `remix/session`, `remix/session-storage/{cookie,fs,memory}` | `@remix-run/session` | Session management |
| `remix/session-storage/redis`, `/memcache` | `@remix-run/session-storage-redis`, `-memcache` | Session storage backends |
| `remix/middleware/session` | `@remix-run/session-middleware` | Cookie-based session middleware |
| `remix/form-data-parser` | `@remix-run/form-data-parser` | `request.formData()` wrapper with streaming uploads |
| `remix/multipart-parser` (+ `/node`) | `@remix-run/multipart-parser` | Multipart stream parser |
| `remix/middleware/form-data` | `@remix-run/form-data-middleware` | FormData parsing middleware |
| `remix/response/{compress,file,html,redirect}` | `@remix-run/response` | Response helpers |
| `remix/html-template` | `@remix-run/html-template` | Auto-escaping HTML template tag |
| `remix/mime` | `@remix-run/mime` | MIME utilities |
| `remix/assets` (+ `/types/hmr`) | `@remix-run/assets` | Fetch-based on-demand compiler/server for browser JS/TS/CSS |
| `remix/multiple-import-maps-polyfill` | `@remix-run/multiple-import-maps-polyfill` | Polyfill for runtime-added import maps |
| `remix/node-fetch-server` (+ `/test`) | `@remix-run/node-fetch-server` | Node `http` <-> Fetch adapter |
| `remix/node-tsx` (+ `/load-module`) | `@remix-run/node-tsx` | Node `--import` loader for TS/JSX (oxc-transform) |
| `remix/node-hmr` (+ `/runtime`, `/types`) | `@remix-run/node-hmr` | Node HMR runner |
| `remix/cli` | `@remix-run/cli` | `remix new/doctor/routes/test/db/assets/version` |
| `remix/test`, `remix/test/cli` | `@remix-run/test` | Test framework (`remix test`) |
| `remix/assert` | `@remix-run/assert` | Node-assert-compatible assertions |
| `remix/terminal` | `@remix-run/terminal` | Terminal output utilities |
| `remix/auth` | `@remix-run/auth` | Browser login, OAuth, OIDC helpers |
| `remix/middleware/auth` | `@remix-run/auth-middleware` | Pluggable auth middleware |
| `remix/middleware/{async-context,compression,cop,cors,csrf,logger,method-override,static}` | `@remix-run/*-middleware` | Request middleware |
| `remix/data-schema` (+ `/checks`, `/coerce`, `/form-data`, `/lazy`) | `@remix-run/data-schema` | Schema validation |
| `remix/data-table` (+ `/cli`, `/migrations`, `/operators`, `/sql-helpers`) | `@remix-run/data-table` | Typed relational query toolkit |
| `remix/data-table/{sqlite,postgres,mysql}` | `@remix-run/data-table-*` | DB adapters |
| `remix/file-storage` (+ `/fs`, `/memory`), `/s3` | `@remix-run/file-storage`, `-s3` | File storage |
| `remix/fs` | `@remix-run/fs` | Web File API filesystem utilities |
| `remix/fetch-proxy` | `@remix-run/fetch-proxy` | Fetch-API HTTP proxy |
| `remix/lazy-file` | `@remix-run/lazy-file@5.0.8` | Lazy streaming files (older, pre-existing package line) |
| `remix/tar-parser` | `@remix-run/tar-parser` | Tar stream parser |

Sources: https://registry.npmjs.org/remix/3.0.0 ; https://github.com/remix-run/remix/releases (every `<pkg>@1.0.0` release is dated 2026-10-01T23:07..23:08Z) ; per-package metadata via `https://registry.npmjs.org/@remix-run/<name>`.

**Separately installed, unstable:** `@remix-run/ui@0.12.1` ("Headless, accessible UI primitives and animation utilities for Remix components"): `accordion`, `anchor`, `combobox`, `listbox`, `menu`, `popover`, `select`, `tabs`, `toggle`, and `@remix-run/ui/animation`. Install: `npm i remix @remix-run/ui`; add `"@remix-run/ui"` to `assets.allowPackages`. https://github.com/remix-run/remix/blob/main/packages/ui/README.md ; https://github.com/remix-run/remix/releases/tag/remix@3.0.0

**Naming lineage of the component runtime (so `remix/ui` and `@remix-run/dom` in the ticket are resolved):**

- `@remix-run/dom`: created on npm 2025-10-02, only `0.0.0-experimental-remix-jam.*` versions, last publish 2026-02-12. The Jam 2025 recap's example imports from `"@remix-run/dom"`. https://registry.npmjs.org/@remix-run/dom ; https://remix.run/blog/remix-jam-2025-recap
- `@remix-run/ui`: created 2026-04-29; during beta/RC `remix/ui` was the component runtime (`jsxImportSource: "remix/ui"`). https://registry.npmjs.org/@remix-run/ui
- `@remix-run/component`: created 2025-12-18; `component@1.0.0` release: "BREAKING CHANGE: The component runtime has moved from `@remix-run/ui` back to `@remix-run/component`." `remix@3.0.0`: "Most existing `remix/ui` usage now moves to `remix/component`"; `jsxImportSource` must become `remix/component`; `remix/ui-hmr` -> `remix/component-hmr`; "The `remix` package no longer exports UI components, primitives, or animation utilities." https://github.com/remix-run/remix/releases/tag/component@1.0.0 ; https://github.com/remix-run/remix/releases/tag/remix@3.0.0 ; `ui@0.12.0` notes: https://github.com/remix-run/remix/blob/main/packages/ui/CHANGELOG.md

## 3. Runtime requirements, TypeScript, bundler, dev/build story

**Node:** `>=24.3.0`.
- `remix@3.0.0` `engines.node: ">=24.3.0"` (https://registry.npmjs.org/remix/3.0.0); same in `@remix-run/node-tsx` and the monorepo root `package.json`.
- Starter template `package.json` `engines.node: ">=24.3.0"` (https://github.com/remix-run/remix/blob/main/template/package.json), and the published CLI hard-codes `MINIMUM_SUPPORTED_NODE_VERSION = '24.3.0'` and writes `engines.node: ">=24.3.0"` into generated apps (`dist/lib/bootstrap-project.js` in the `@remix-run/cli@1.0.0` tarball, https://registry.npmjs.org/@remix-run/cli/1.0.0).
- CONTRIBUTING: "We develop Remix using pnpm on Node 24.3 or newer." https://github.com/remix-run/remix/blob/main/CONTRIBUTING.md

**Bun / Deno / Cloudflare Workers:**
- Root README: "Remix packages work seamlessly across Node.js, Bun, Deno, Cloudflare Workers, and other environments." https://github.com/remix-run/remix/blob/main/README.md
- Request Handling guide, "Alternate runtimes: Bun, Deno, Workers": "Bun, Deno, and edge worker runtimes already accept Fetch handlers, so they do not need the Node adapter," with `Bun.serve({ fetch: router.fetch })`, `Deno.serve(router.fetch)`, and `export default { fetch(request) { return router.fetch(request) } } satisfies ExportedHandler` examples. https://github.com/remix-run/remix/blob/main/packages/remix/guides/03-request-handling.md
- The monorepo runs package tests under Bun too (`"test:bun": "bun x --bun remix test"` e.g. in `packages/headers/package.json`; root `test:bun`). https://github.com/remix-run/remix/blob/main/packages/headers/package.json
- A Cloudflare Workers demo exists for the server packages only (`fetch-router`, `session`, `cookie`, `html-template`, `data-schema`, middleware) with `wrangler ^4.90.1`, `compatibility_date: 2025-11-18`, D1. It does not use `remix/component`, `remix/assets`, or `remix/node-*`. https://github.com/remix-run/remix/tree/main/packages/fetch-router/demos/cf-workers
- Node-specific pieces: `node-fetch-server`, `node-tsx` (`--import` loader), `node-hmr`, and `assets` (native deps: `oxc-transform`, `oxc-parser`, `oxc-minify`, `oxc-resolver`, `lightningcss`, `chokidar`). https://github.com/remix-run/remix/blob/main/packages/assets/package.json ; https://github.com/remix-run/remix/blob/main/packages/node-tsx/package.json
- No Bun or Deno version floor is published anywhere found.

**TypeScript:** No published floor.
- `remix new` writes `"typescript": "latest"` and `"@types/node": "latest"` (CLI `bootstrap-project.js`, see above). The monorepo catalog pins `typescript: ^7.0.2` and `@types/node: ^24.6.0` (https://github.com/remix-run/remix/blob/main/pnpm-workspace.yaml).
- Generated `tsconfig.json`: `strict`, `lib: ["ES2024","DOM","DOM.Iterable"]`, `types: ["node","remix/assets/types/hmr"]`, `module`/`moduleResolution: NodeNext`, `allowImportingTsExtensions`, `rewriteRelativeImportExtensions`, `verbatimModuleSyntax`, `isolatedModules`, `jsx: "react-jsx"`, `jsxImportSource: "remix/component"`, `noEmit`. https://github.com/remix-run/remix/blob/main/template/tsconfig.json
- `node-tsx` README: the loader "does not type check, change Node.js module resolution, apply TypeScript path aliases, or downlevel JavaScript syntax"; "Do not enable `erasableSyntaxOnly`". https://github.com/remix-run/remix/blob/main/packages/node-tsx/README.md

**Bundler: not required; no build step.**
- Principle 3 "Religiously Runtime": "All packages must be designed with no expectation of static analysis and all tests must run without bundling. Because browsers are involved, `--import` loaders for simple transformations like TypeScript and JSX are permissible." https://github.com/remix-run/remix/blob/main/README.md
- Start Here: "Remix APIs do not depend on bundlers, type generation, or static analysis" and describes the asset setup as "this bundlerless setup". https://github.com/remix-run/remix/blob/main/packages/remix/guides/01-start-here.md
- `remix/assets`: "Fetch-based server for compiling browser assets on demand" with ETags, optional fingerprinting, source maps, HMR; served from `app/**/public/**` and allowed packages. https://github.com/remix-run/remix/blob/main/packages/assets/README.md

**Sanctioned dev server / build / start (starter template):**
- `dev`: `NODE_ENV=development node --watch --import remix/node-tsx server.ts`
- `hmr`: `NODE_ENV=development node hmr.ts` (uses `remix/node-hmr`)
- `start`: `NODE_ENV=production node --import remix/node-tsx server.ts`; template AGENTS.md: "`npm run start` runs in production mode without a separate build step."
- `test`: `NODE_ENV=test remix test`; `typecheck`: `tsc --noEmit`
- `server.ts` uses `node:http` + `createRequestListener(router.fetch)` from `remix/node-fetch-server`, port 44100.
Sources: https://github.com/remix-run/remix/blob/main/template/package.json ; https://github.com/remix-run/remix/blob/main/template/server.ts ; https://github.com/remix-run/remix/blob/main/template/AGENTS.md ; CLI commands (`new`, `assets`, `doctor [--fix]`, `db migrate|rollback|status|reset`, `routes`, `test`, `version`, `completion`) and `remix.json` config: https://github.com/remix-run/remix/blob/main/packages/cli/README.md

**Browser requirements (component runtime):** Frame/soft navigation "requires both `window.navigation` and `NavigateEvent.sourceElement`. Browsers missing either capability use document navigation"; `remix/multiple-import-maps-polyfill` covers browsers without multiple import-map support. https://github.com/remix-run/remix/blob/main/packages/component/README.md

## 4. Official position on React, the component model, interop

**Remix 3 is not React and does not depend on React.**
- Repo app skill (shipped into every generated app): "Remix components use JSX, but they are not React. A component's setup function runs once per instance and returns a render function. ... Do not apply React hooks or lifecycle assumptions." https://github.com/remix-run/remix/blob/main/.agents/skills/remix/SKILL.md
- "Wake up, Remix!" (2025-05-28): "no critical dependencies, not even React. Instead, we're building our own component model that feels closer to the web than anything we've seen before." and "We're starting with a fork of Preact, a mature virtual DOM library". https://remix.run/blog/wake-up-remix
- Remix Jam 2025 recap: "Remix 3 would not be built on React". https://remix.run/blog/remix-jam-2025-recap
- "A Brand New Remix" (2026-05-06): remix.run is built on Remix 3 "notably without React". https://remix.run/blog/brand-new
- `@remix-run/component@1.0.0` has a single runtime dependency, `@types/dom-navigation` (types only); no `react`, `react-dom`, or `preact`. https://github.com/remix-run/remix/blob/main/packages/component/package.json
- React Router is the React path: SECURITY.md: "Remix v2 was upstreamed into React Router v7." https://github.com/remix-run/remix/blob/main/SECURITY.md

**Component model name:** `@remix-run/component` (imported as `remix/component`): "A minimal component system built on JavaScript and DOM primitives. Write components that render on the server, stream to the browser, and hydrate only where you need interactivity." Components are `function Counter(handle: Handle<Props>) { let count = 0; return () => <button mix={on('click', () => { count++; handle.update() })}>...</button> }`. Features: `mix` composition with `on`/`css`/refs, `createMixin`, `Frame` (streaming/async UI), `clientEntry()` hydration, `run()` client runtime, server rendering via `remix/component/server`, JSX via `jsxImportSource: remix/component` (the tsconfig `jsx: "react-jsx"` value is only the TypeScript transform mode name). https://github.com/remix-run/remix/blob/main/packages/component/README.md ; docs: https://github.com/remix-run/remix/tree/main/packages/component/docs

**Preact fork status:** The only Preact reference in shipped source is a type file header, "Adapted from Preact ... License: MIT ... Copyright (c) 2015-present Jason Miller" in `packages/component/src/runtime/dom.ts` (DOM attribute typings). The package LICENSE is "Copyright (c) 2025 Shopify Inc." Preact also appears only as a benchmark competitor under `packages/component/bench/frameworks/`. Whether any runtime code still descends from the 2025 Preact fork cannot be confirmed from these sources (see open questions). https://github.com/remix-run/remix/blob/main/packages/component/src/runtime/dom.ts

**React interop path:** The RC post says "you can even swap our `render` middleware with a React-based one if you really want to," i.e., bring your own renderer behind `remix/middleware/render`; it names no first-party package. Code search for `react-dom` in the repo finds only benchmarks, a polyfill test, and an internal comment, and there is no `@remix-run/react*` package in the v3 package list. Conclusion: no official React interop or migration shim exists; the expectation in the ticket ("we expect none") holds. https://remix.run/blog/remix-3-release-candidate ; https://github.com/remix-run/remix/tree/main/packages

## 5. Stability and support policy

- **SemVer commitment:** RC post: "it's time to ship and start binding ourselves to SemVer so you can trust Remix with your ideas." https://remix.run/blog/remix-3-release-candidate. Each `CHANGELOG.md` header: "It follows semantic versioning." e.g. https://github.com/remix-run/remix/blob/main/packages/remix/CHANGELOG.md
- **What "breaking" means per package tier** (CONTRIBUTING, "Adding a Change File"): `major` = "Breaking changes for stable packages"; `minor` = "New features (as well as breaking changes for `v0.x` packages)"; `patch` = bug fixes. So `@remix-run/ui@0.x` can break in a minor. https://github.com/remix-run/remix/blob/main/CONTRIBUTING.md
- **Release mechanics:** automated `release-pr` + `publish` workflows; prereleases go to the `next` tag; stable graduation removes the prerelease channel. https://github.com/remix-run/remix/blob/main/MAINTAINING.md
- **Security support:** SECURITY.md supports `3.x` only; `<= 2.x` unsupported (report in React Router). https://github.com/remix-run/remix/blob/main/SECURITY.md
- **No LTS, no cadence promise, no deprecation window** is stated in README, CONTRIBUTING, MAINTAINING, SECURITY, the blog posts, or the guides. "Long-term support" is mentioned only for React Router v7 as the home for Remix v1/v2 users (Wake up, Remix!). https://remix.run/blog/wake-up-remix
- **Observed cadence:** beta post promised "new features and releases every week" (https://remix.run/blog/remix-3-beta-preview); five RCs in 31 days; `Release v3.1.0` queued 2026-10-07, six days after 3.0.0 (https://github.com/remix-run/remix/pull/11978). The `remix` umbrella depends on every sub-package at `^1.0.0`; the `3.0.0` cut itself carried a breaking rename (`remix/ui` -> `remix/component`) relative to rc.5.
- **Docs maturity:** guide 14 "CLI and Tooling" opens with "This chapter is unfinished"; guide 15 "Production" is an outline with instructions to the authors ("Explain when a deployment should keep that server..."). The RC post acknowledges docs are still "actively updating". https://github.com/remix-run/remix/blob/main/packages/remix/guides/14-cli-and-tooling.md ; https://github.com/remix-run/remix/blob/main/packages/remix/guides/15-production.md
- **Feature requests** require a Proposal Discussion before any PR; issues need a minimal runnable repro. https://github.com/remix-run/remix/blob/main/CONTRIBUTING.md

## Implications for SCC (React Router 8 SPA + Hono on Cloudflare Workers)

Facts only; decision belongs to #181.

- The SPA shape maps to `remix/spa@1.0.0` (stable): the same fetch router runs in the browser and renders `remix/component` nodes via `render()` middleware. https://github.com/remix-run/remix/blob/main/packages/spa/README.md
- The server shape maps to `router.fetch` behind a Workers `export default { fetch }`, documented in guide 03 and demonstrated for server-only packages in the cf-workers demo. What is *not* demonstrated officially is `remix/component` SSR, `remix/assets`, or HMR on Workers; `assets`/`node-tsx`/`node-hmr` depend on Node and native binaries. A community (not official) "remix-cloudflare" adapter was posted in Discussions on 2026-10-11: https://github.com/remix-run/remix/discussions/11983
- Every React component, hook, and React Router API would be rewritten; there is no official shim.

## Open questions / unverified

- **Whether the stable release was announced at Remix Jam on 2026-10-02.** The npm publish and GitHub release are dated 2026-10-01 (UTC); no blog post, Jam-page update, or GitHub Discussion announcement was found as of 2026-10-12. Talk recordings were not checked (no primary text source).
- **Preact lineage of the runtime.** The 2025 blog said "starting with a fork of Preact"; the shipped `@remix-run/component@1.0.0` has no Preact dependency and only one "Adapted from Preact" typings file. Whether runtime reconciliation code still derives from Preact was not verified (would require a source-level diff).
- **TypeScript floor.** None published. The generated tsconfig uses `rewriteRelativeImportExtensions` and the monorepo pins `typescript ^7.0.2`; what the oldest working TS version is was not tested.
- **Bun as a dev/prod runtime for a full app.** Documented only as a Fetch-handler host (`Bun.serve`) and as a test runner in the monorepo. Whether `remix/assets`, `remix/component-hmr`, and `remix new` output work under `bun` without Node was not tested; no Bun version floor exists.
- **Cloudflare Workers for the full stack** (component SSR + assets). Not demonstrated in any official demo or guide; only the router/middleware layer is.
- **Status of `@remix-run/interaction@0.5.0`** (last published 2026-01-28; not in `remix@3.0.0` deps): abandoned, folded into `component`, or still planned. Not stated anywhere found.
- **Umbrella versioning rule.** Whether a future major of any `@remix-run/*` sub-package will always coincide with a `remix` major (the umbrella pins `^1.0.0`) is not documented.
- **LTS / support window for 3.x once 4.x ships.** Not documented; SECURITY.md only says 3.x is currently supported.
- `remix.run/docs` redirects (302) to `guides.remix.run`, which shows no version banner; the API reference at `api.remix.run` likewise shows no version or stability labels. Treat the installed `node_modules/remix/INDEX.md` + READMEs as canonical for a given version, as the repo skill instructs.
