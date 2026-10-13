# Remix v3 on Cloudflare Workers

Research for GitHub issue #176 (map #174; feeds #182 and #186). Date: 2026-10-12.

Scope: how a Remix v3 (`remix@3.0.0`, `remix-run/remix` `main`) app runs on Cloudflare Workers, and
whether it supports the request-handling features SCC's Hono backend relies on
(`packages/backend/src/index.ts`, `packages/backend/src/middleware/geo-restriction.ts`,
`packages/backend/lib/environment.ts`, `packages/backend/wrangler.jsonc`) and the React Router
page pattern in `packages/frontend/app/routes/builder/summary.tsx`
(`clientLoader`/`clientAction`/`useFetcher`/`Form`/`redirect`, with `ssr: false` in
`packages/frontend/react-router.config.ts`).

Sources are primary only: `remix.run` (which redirects to `guides.remix.run`), the
`remix-run/remix` repository on `main`, and `developers.cloudflare.com`. Every claim links its
source. Things I could not confirm are listed at the end.

## Summary

1. **Entry point / wrangler / build.** Yes: a Remix v3 router is a plain fetch handler, and the
   official guide shows the Workers entry as `export default { fetch(request) { return router.fetch(request) } } satisfies ExportedHandler`.
   There is no Remix Cloudflare package, adapter, or template; the only shipped template and dev
   scripts are Node (`node --watch --import remix/node-tsx server.ts`). Wrangler's own esbuild
   bundling (`main`, `compatibility_date`, `assets`) is the build; Remix has no build step of its own.
2. **Env.** `router.fetch(input, init?)` takes no env/platform argument and the request context has
   no env slot. Bindings reach handlers either via `import { env } from "cloudflare:workers"`
   (module scope, documented by Cloudflare) or by a router middleware that stores the per-request
   `env` under a `createContextKey()`. Workers `env` is a plain object of string `vars`/secrets plus
   binding objects, so SCC's `validate*Environment(env)` zod parsers accept it unchanged.
3. **`request.cf.country` and middleware.** The router stores the incoming `Request` object as-is
   (`createRequestContext` reuses it when no `init` is given), so `context.request.cf?.country` is
   the direct equivalent of Hono's `c.req.raw.cf?.country`. Remix v3 has first-class middleware at
   router, controller, and action scope with the same `(context, next)` short-circuit semantics as
   Hono; no wrapper is needed. Miniflare (behind `wrangler dev`) fetches a real `cf` object and
   caches it, so geo checks also run locally.
4. **Serving the UI.** Remix v3 is its own component runtime (not React, not a Preact fork; one
   file is adapted from Preact's type definitions). It renders JSX to HTML on the server,
   hydrates only `clientEntry()` components, and after `run()` intercepts same-origin links and forms
   via the browser Navigation API ("frame" reloads). A pure client mode exists (`remix/spa`), and its
   only demo is a Vite-built SPA. Replacements: `clientLoader`/`clientAction` -> route actions
   (`get()`/`form()` routes, `context.formData`, `context.render(...)`, `redirect(...)`);
   `useFetcher` -> `fetch()` inside an `on(...)` handler with `handle.update()`, or a `<Frame>` +
   `handle.frame.reload()`; `<Form>` -> plain `<form method="post">`.
5. **Static assets.** Remix's `staticFiles()` and `createAssetServer()` are Node-only (they import
   `node:fs`/`node:path`, watch the file system, and compile TS/CSS on demand with native
   oxc/lightningcss). The guide says so explicitly and tells Worker deployments to serve static
   assets through the platform. Workers Static Assets (`assets.directory`, `binding: "ASSETS"`,
   `run_worker_first`, `not_found_handling`) is the fit; client JS must be pre-built by something
   other than Remix (the SPA demo uses Vite; Cloudflare's Vite plugin builds client + Worker).
6. **Local dev.** Remix's dev loop is Node: `node --watch` (restart) or `node hmr.ts` using
   `remix/node-hmr` (server HMR + browser HMR channel). Neither runs inside workerd. For a Worker
   target the loop is `wrangler dev` (Miniflare/workerd, bindings simulated, assets served from
   disk) or `vite dev` with `@cloudflare/vite-plugin` (Vite HMR, Worker in workerd). Cloudflare's
   docs I read do not state wrangler's rebuild-on-save behaviour explicitly.

## 1. Workers entry point, wrangler config, build

### What Remix v3 is (repo shape)

- The `remix-run/remix` README says it "is the source repository for Remix 3" and "is under active
  development"; packages are "portable by default" and support "Node.js, Bun, Deno, Cloudflare
  Workers, and other environments". It lists 47 packages including `fetch-router`,
  `node-fetch-server`, `component`, `assets`, `node-hmr`, `cli`, `ui`; there is no `dom` package and
  no Cloudflare package. https://github.com/remix-run/remix
- `packages/remix/package.json` is `3.0.0` and re-exports everything under subpaths such as
  `remix/router`, `remix/routes`, `remix/component`, `remix/component/server`, `remix/spa`,
  `remix/assets`, `remix/middleware/*`, `remix/node-fetch-server`, `remix/node-hmr`,
  `remix/response/redirect`. No subpath mentions `dom`, `ui`, or `cloudflare`.
  https://github.com/remix-run/remix/blob/main/packages/remix/package.json
- The repo root has a single `template/` (used by `remix new`) and a `demos/` folder (`assets`,
  `bookstore`, `frame-navigation`, `frames`, `i18n`, `lazy-frames`, `social-auth`, `spa`, `sse`,
  `timeboxer`, `ui`, `unpkg`); none is Cloudflare-specific. https://github.com/remix-run/remix

### The router is a fetch handler; the documented Worker entry

- "A Remix router is a fetch handler" that takes a `Request` and resolves to a `Response`; the guide
  says "That call is the same whether it comes from a Node server, a Bun server, a Cloudflare Worker,
  or a test." https://guides.remix.run/request-handling/
- The guide's Cloudflare entry, verbatim (source line 137-147 of the chapter):

  ```ts
  import { router } from "./app/router.ts";

  export default {
    fetch(request) {
      return router.fetch(request);
    },
  } satisfies ExportedHandler;
  ```

  followed by: "These abbreviated entries omit the error logging from the Node example. Add a
  `try`/`catch` around `router.fetch(...)` when the runtime's default error response and logging are
  not what the app needs." and "The router contract is portable, but every package in a middleware
  stack may not be. For example, the current static-file and compression middleware use Node
  filesystem and compression APIs. On a worker, serve static assets through the platform and use the
  platform's response compression instead."
  https://github.com/remix-run/remix/blob/main/docs/guides/app/actions/docs/chapters/03-request-handling.md
- `router.fetch` signature in source: `fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>`
  (no third argument). https://github.com/remix-run/remix/blob/main/packages/fetch-router/src/lib/router.ts
- If no route matches, the router returns 404; if middleware or an action throws, `router.fetch`
  rejects and "the server entry is the last place to catch that error and turn it into a 500".
  https://guides.remix.run/request-handling/
- Cloudflare's handler shape is `export default { async fetch(request, env, ctx) { ... } }`.
  https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/

### The shipped template is Node-only

- `template/server.ts` uses `node:http` + `createRequestListener(router.fetch, ...)` from
  `remix/node-fetch-server`, listens on 44100, and handles `SIGINT`/`SIGTERM`.
  https://github.com/remix-run/remix/blob/main/template/server.ts
- `template/package.json` scripts: `"dev": "NODE_ENV=development node --watch --import remix/node-tsx server.ts"`,
  `"hmr": "NODE_ENV=development node hmr.ts"`, `"start": "NODE_ENV=production node --import remix/node-tsx server.ts"`;
  `engines.node >= 24.3.0`; the only dependency is `remix`.
  https://github.com/remix-run/remix/blob/main/template/package.json
- `node-fetch-server` "covers only Node.js servers" and does not mention Cloudflare.
  https://github.com/remix-run/remix/blob/main/packages/node-fetch-server/README.md
- The Production guide (marked unfinished) says a production app is "a Fetch handler behind a
  runtime adapter" and that "some runtimes need a different Fetch adapter"; it names no platform.
  https://guides.remix.run/production/

### Build: Wrangler bundles; Remix has no build step

- Remix: "Remix APIs do not depend on bundlers"; assets are "source-served" in a "bundlerless setup";
  the only run command is `npm run dev`. https://guides.remix.run/start-here/ The homepage says
  assets "compile on demand in development and production, so there is no separate application
  build step". https://remix.run/
- Wrangler "uses esbuild to process the Worker code for development and deployment"; in default
  bundling mode it "traverses all of your code's imports and produces one JavaScript entry-point
  file". Required keys to deploy: `name`, `main`, `compatibility_date` (`main` optional only for
  assets-only Workers). `compatibility_flags` is optional. `assets` keys: `directory`, `binding`,
  `run_worker_first` (`boolean | string[]`, default `false`), `html_handling`
  (default `"auto-trailing-slash"`), `not_found_handling` (default `"none"`).
  https://developers.cloudflare.com/workers/wrangler/configuration/
- `wrangler types` generates `worker-configuration.d.ts` with an `Env` interface reflecting the
  bindings. https://developers.cloudflare.com/workers/wrangler/commands/workers/
- Node compatibility: with a `compatibility_date` of 2026-08-04 or later, `nodejs_compat` and
  `nodejs_compat_v2` are on by default; between 2024-09-23 and 2026-08-03 add the `nodejs_compat`
  flag. SCC's current `compatibility_date` is `2025-02-26` with the flag commented out
  (`packages/backend/wrangler.jsonc`). https://developers.cloudflare.com/workers/runtime-apis/nodejs/
- Implication for SCC: the Worker `main` would import `remix/router` (deps: only
  `@remix-run/route-pattern`, https://github.com/remix-run/remix/blob/main/packages/fetch-router/package.json)
  and Wrangler bundles it. Nothing in the router or middleware core requires a Remix build.

## 2. Per-request env / bindings

### What Remix provides

- The request context "starts with `request`, `url`, a mutable `headers` copy, `method`, `params`,
  and `router`"; middleware adds values with `context.set(key, value)` / `context.get(key)` using
  `createContextKey<T>()`; the guide states request context is "an explicit per-request value, not
  a global". The page "does not document how to pass env, bindings, or other platform data into the
  context". https://guides.remix.run/request-handling/
- The `RequestContext` constructor stores the `Request` and derives `url` from it; there is no
  env/platform field. https://github.com/remix-run/remix/blob/main/packages/fetch-router/src/lib/request-context.ts
- Typed context is declared by module augmentation (`declare module "remix" { interface RouterTypes { context: AppContext } }`),
  with `RouterContext<typeof router>` / `MiddlewareContext<[...]>`.
  https://guides.remix.run/request-handling/ and https://github.com/remix-run/remix/blob/main/template/app/router.ts
- `asyncContext()` / `getContext()` (`remix/middleware/async-context`) store the context in
  `AsyncLocalStorage` from `node:async_hooks`.
  https://github.com/remix-run/remix/blob/main/packages/async-context-middleware/src/lib/async-context.ts
  Workers support `AsyncLocalStorage` natively (`nodejs_als` or `nodejs_compat`).
  https://developers.cloudflare.com/workers/runtime-apis/nodejs/

### What Cloudflare provides

- `vars` are available on the `env` parameter of `fetch(request, env, ctx)`; secrets "are also
  environment variables, so your Worker reads them from `env` the same way". `vars` values "can be
  strings or nested objects". `.dev.vars` (dotenv syntax) supplies local values.
  https://developers.cloudflare.com/workers/configuration/environment-variables/
- `import { env } from "cloudflare:workers"` exposes the same bindings at module scope ("to reach
  bindings from anywhere in your code"). https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/
  and https://developers.cloudflare.com/workers/configuration/environment-variables/
- "the same `env` object may be passed to multiple requests, as long as the environment hasn't
  changed". https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/

### Fit with SCC's validators

- `validateBaseEnvironment(c.env)` etc. take `Record<string, string>` and call `schema.parse`
  (`packages/backend/lib/environment.ts`). The Workers `env` object satisfies this at runtime for
  string `vars`/secrets; zod object parsing ignores the extra non-string keys (e.g. an `ASSETS`
  binding). Only the TypeScript type needs a cast or a narrower `Env` from `wrangler types`.
- Two documented ways to reach `env` from a Remix action/middleware:
  1. `import { env } from "cloudflare:workers"` inside the middleware module (Cloudflare-documented;
     keeps `router.fetch(request)` single-argument as in the Remix guide).
  2. A router middleware factory that receives the `env` passed to `fetch(request, env)` and does
     `context.set(EnvKey, env)` (Remix-documented context mechanism). Because `router.fetch` does
     not accept extra arguments, the Worker entry must bridge: either rebuild the middleware per
     `env` (Cloudflare says `env` is stable across requests) or key a `WeakMap<Request, Env>` on
     the incoming `Request`, which the router reuses unchanged (see section 3). The `WeakMap`
     approach is my inference from source, not a documented pattern.

## 3. `request.cf.country` and middleware

### `request.cf` survives into the handler

- `createRequestContext`: `let request = input instanceof Request && init == null ? input : new Request(input, init)`
  then `new RequestContext(request)`; the constructor assigns `this.request = request`. So when the
  Worker calls `router.fetch(request)` with the incoming `Request` and no `init`, `context.request`
  is the very object Cloudflare handed in.
  https://github.com/remix-run/remix/blob/main/packages/fetch-router/src/lib/router.ts and
  https://github.com/remix-run/remix/blob/main/packages/fetch-router/src/lib/request-context.ts
- Cloudflare: `request.cf` (`IncomingRequestCfProperties`) is read-only on the inbound `Request`
  passed to `fetch()`; `country` is "a two-letter country code ... typed as `string | null`",
  matching `CF-IPCountry`. Workers type definitions put `cf` on `Request`, which "is not directly
  compatible with the standard `lib.dom` `Request` type, so you may need type assertions". `request.cf`
  is unavailable in the dashboard Playground. https://developers.cloudflare.com/workers/runtime-apis/request/
- Equivalent of SCC's `c.req.raw.cf?.country` (`packages/backend/src/middleware/geo-restriction.ts`):
  `(context.request as Request<unknown, IncomingRequestCfProperties>).cf?.country`.

### Middleware exists; scoping to `/api/*`

- Middleware is `(context, next)`; "Returning a `Response` without calling `next()` ends the chain
  early." Three scopes run in order: router (every request, before matching), controller (that
  controller's direct actions), action. https://guides.remix.run/request-handling/
- "Every middleware must return a `Response`, return the result of `next()`, or await `next()`
  before returning. Otherwise it throws at runtime." Group-level middleware goes on the installer's
  controllers (`router.mount(prefix, installer)`); "Middleware stays on routers, controllers, and
  actions." https://github.com/remix-run/remix/blob/main/packages/fetch-router/README.md
- So SCC's `app.use('/api/*', GeoRestrictionConfig)` maps to controller middleware on the API
  controller (or a `router.mount('/api', ...)` group), returning `Response.json({ error }, { status: 403 })`
  early; `app.use('/api/*', CorsConfig)` maps to `cors({ origin: [ALLOWED_ORIGIN], ... })` from
  `remix/middleware/cors`, which "can either short-circuit preflight requests or pass them through"
  and accepts `string | RegExp | Array | true | (origin, context) => ...`.
  https://github.com/remix-run/remix/blob/main/packages/cors-middleware/README.md
- Method handling: a URL match with no method match yields `405` with an `Allow` header; `HEAD`
  reuses `GET`. https://github.com/remix-run/remix/blob/main/packages/fetch-router/README.md
- Local dev: Miniflare "will fetch the `Request#cf` object from a trusted Cloudflare endpoint" and
  cache it to `node_modules/.mf/cf.json`; override with `cf: false`, `cf: "cf.json"`, or
  `CLOUDFLARE_CF_FETCH_ENABLED=false` / `CLOUDFLARE_CF_FETCH_PATH` ("useful ... when running
  `wrangler dev`"). https://developers.cloudflare.com/workers/testing/miniflare/get-started/

## 4. Serving the UI: SSR, hydration, navigation, SPA, and the React Router replacements

### The runtime is not React and not a Preact fork

- `@remix-run/component` (`1.0.0`) is a "Component runtime with server rendering and browser
  hydration"; its only dependency is `@types/dom-navigation`. No `preact` dependency.
  https://github.com/remix-run/remix/blob/main/packages/component/package.json
- A GitHub code search for `preact` in the repo hits only the benchmark harness, a listbox README,
  and `packages/component/src/runtime/dom.ts`, whose header reads "Adapted from Preact: - Source:
  https://github.com/preactjs/preact/blob/.../src/dom.d.ts" (type definitions, MIT).
  https://github.com/remix-run/remix/blob/main/packages/component/src/runtime/dom.ts
- Exports: `run`, `createRoot`, `clientEntry`, `Fragment`, `Frame`, `createElement`, `on`, `link`,
  `ref`, `attrs`, `css`, `createMixin`, `navigate`, `spaResponse`, `unsafeHTML`.
  https://github.com/remix-run/remix/blob/main/packages/component/src/index.ts
- Server exports: `renderToStream`, `renderToString`, `ImportMap`, `createVNode`.
  https://github.com/remix-run/remix/blob/main/packages/component/src/server/stream.ts
- JSX config: `jsx: react-jsx`, `jsxImportSource: remix/component`. https://guides.remix.run/cli-and-tooling/

### Server render + selective hydration + Navigation-API navigation

- Actions return pages with `context.render(<Page/>)` (from `render()` middleware), which goes to
  `createHtmlResponse()`; a component is a setup function `(handle) => () => jsx`; state is plain
  variables and `handle.update()` re-renders. The document shell is an explicit `<html>` component
  with `<ImportMap>`, `modulepreload` links, and `<script type="module" src={href}>`.
  https://guides.remix.run/rendering-ui/
- "The same component model runs on the server and in the browser ... Pages do not need browser
  JavaScript unless part of them handles events or uses browser APIs. Interactive components are
  marked with `clientEntry(...)`." https://guides.remix.run/rendering-ui/
- `clientEntry(import.meta.url, Component)` marks "the smallest interactive component"; props must
  be serializable; `run()` is called once from the entry module with a `loadModule` hook; `run()`
  "hydrates the page but is not a second router. Browser requests still go to the route actions that
  own the server behavior." `createRoot(container)` is for client-only widgets.
  https://guides.remix.run/interactivity/
- Navigation: "Links stay real anchors. After `run()` starts, same-origin navigations go through the
  browser's Navigation API"; frame attributes `data-rmx-target`, `data-rmx-src`,
  `data-rmx-history="push|replace"`, `data-rmx-document` (force full navigation); `navigate(href, options)`
  and `link(href, options)` for programmatic cases; back/forward always reload the document.
  https://guides.remix.run/interactivity/ Frame navigation "requires both `window.navigation` and
  `NavigateEvent.sourceElement`. Otherwise, the browser handles navigation normally." The default
  resolver sends `X-Remix-Frame: true` and uses `same-origin` fetch mode.
  https://github.com/remix-run/remix/blob/main/packages/component/README.md and
  https://github.com/remix-run/remix/blob/main/packages/component/docs/frames.md

### Pure client / SPA mode

- `remix/spa` is "a client-rendered routing layer": `createRouter({ middleware: [render()] })`,
  actions call `render(<h1>Home</h1>)`, and `run(router, { fallback })` "resolves the current URL,
  and later frame navigations, through the router". Nothing on the page describes SSR, the HTML
  shell, or forms. https://github.com/remix-run/remix/blob/main/packages/spa/README.md
- `demos/spa` is "This Vite app uses Remix as a client-only router"; `package.json` scripts are
  `"dev": "vite"`, `"build": "vite build"`, `"preview": "vite preview"` with `vite@7.3.3`;
  `index.html` is a static shell with `<script type="module" src="/app/main.tsx">`; `main.tsx` does
  `run(router, { fallback: <LoadingIndicator/> })`; the controller handles a `POST` form by reading
  `await request.formData()` inside the browser-side action.
  https://github.com/remix-run/remix/tree/main/demos/spa
- `createRoot`, `clientEntry`, `spaResponse` are exported from `remix/component`.
  https://github.com/remix-run/remix/blob/main/packages/component/src/index.ts

### Replacing `summary.tsx`'s React Router pattern

`summary.tsx` today: `clientLoader` reads `localStorage` user (via `getUser`) and query params;
`clientAction` validates with zod, writes `localStorage`, returns `redirect(returnUrl ?? '/finish-up')`
or `data({ errors }, { status: 400 })`; `useFetcher().submit(formData, { method: 'POST', action: '/api/summary' })`
fires once on mount to load suggestions; `<Form method="post">` renders the editor.

| React Router (today) | Remix v3 equivalent | Source |
| --- | --- | --- |
| `clientLoader` | A `GET` action on a `get()`/`form()` route that returns `context.render(<Page .../>)`. In `remix/spa` the action runs in the browser, so `localStorage` is still reachable. On the server, `localStorage` is not available; data must come from the request (cookie/session) or stay client-side. | https://guides.remix.run/start-here/ , https://github.com/remix-run/remix/blob/main/packages/spa/README.md |
| `clientAction` + `redirect` | The `POST` action of a `form()` route: parse `context.formData` (`formData()` middleware) or `await request.formData()` (SPA demo), validate with `remix/data-schema` or zod, re-render with `{ status: 400 }` on failure, return `redirect(href, 303)` from `remix/response/redirect` on success. | https://guides.remix.run/forms-and-mutations/ , https://github.com/remix-run/remix/tree/main/demos/spa |
| `data({ errors }, { status })` | `context.render(<Page values issues />, { status: 400 })` ("redirecting back to the GET action would discard the user's changes and errors, so the failure branch renders directly"). | https://guides.remix.run/forms-and-mutations/ |
| `<Form method="post">` | `<form method="post" action={routes.x.action.href(...)}>`; "With the browser runtime active, Remix treats form submissions as navigations. It renders validation responses into the page and follows redirects after a successful save." | https://guides.remix.run/forms-and-mutations/ |
| `useFetcher` background POST for suggestions | (a) `fetch(url, { signal })` inside `on("input"/..., async (event, signal) => ...)` or in setup, then `handle.update()`; the guide's "search pattern" passes a URL as a prop and aborts stale requests via the signal. (b) `<Frame src="/api/..."/>` streamed with a fallback and `handle.frame.reload()` to re-fetch. The guide does not name a `useFetcher` equivalent; (a)/(b) are the documented primitives. | https://guides.remix.run/interactivity/ , https://guides.remix.run/streaming-ui-with-frames/ , https://github.com/remix-run/remix/blob/main/packages/component/docs/frames.md |
| `fetcher.state` / `<Loading fetcher>` | Local `pending` variable in setup scope set before the request and cleared after; for forms, listen to the frame's `reloadStart`/`reloadComplete` events (`SaveButton` example). | https://guides.remix.run/interactivity/ , https://guides.remix.run/forms-and-mutations/ |
| `useLoaderData` / `useActionData` | Props passed to the page component by the action (`<AlbumEditPage album values issues />`). | https://guides.remix.run/forms-and-mutations/ |

Note: `summary.tsx` posts to `/api/summary`, while the backend exposes `/api/summaries`; that
mismatch is pre-existing and outside this ticket.

## 5. Static assets (CSS, favicon, client JS) under Workers Static Assets

### What Remix ships is Node-only

- `staticFiles()` (`remix/middleware/static`) serves a directory with ETag/range support; its source
  imports `node:path` and `node:fs` and uses `openLazyFile` from `@remix-run/fs`, which itself
  imports `node:fs` and `node:events`.
  https://github.com/remix-run/remix/blob/main/packages/static-middleware/src/lib/static.ts ,
  https://github.com/remix-run/remix/blob/main/packages/fs/src/lib/fs.ts
- `createAssetServer()` (`remix/assets`) "compiles browser scripts and styles on demand", watches
  the file system by default, and produces import maps, preloads, and fingerprinted URLs; its
  dependencies are `oxc-transform`, `oxc-parser`, `oxc-minify`, `oxc-resolver`, `lightningcss`,
  `chokidar`, `es-module-lexer`, `get-tsconfig`, `magic-string`, `picomatch`, `source-map-js`.
  Examples use `node:path`, `import.meta.dirname`, `process.cwd()`, `createFsFileCache()`. The README
  "doesn't describe a separate build command for producing production output".
  https://github.com/remix-run/remix/blob/main/packages/assets/README.md ,
  https://github.com/remix-run/remix/blob/main/packages/assets/package.json
- The Files and Assets guide (unfinished) says production should set `watch: false`, targets,
  minification, and `fingerprint: true`; an ahead-of-time build to disk "is not mentioned".
  https://guides.remix.run/files-and-assets/
- The Request Handling guide: "the current static-file and compression middleware use Node
  filesystem and compression APIs. On a worker, serve static assets through the platform".
  https://guides.remix.run/request-handling/
- Workers' `node:fs` is a virtual in-memory file system (`/bundle` read-only, `/tmp`, `/dev`);
  `fs.watch`/`fs.watchFile` are unsupported, and the page does not say the assets directory is
  readable through it. https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/

### Client entries without the asset server

- `render({ assets })`: `assets` is optional; "You can omit it if your client entries already use
  public URLs or if you have no client entries."
  https://github.com/remix-run/remix/blob/main/packages/render-middleware/README.md
- Source: a `file:` entry ID without an asset server throws "clientEntry() cannot use a file:
  source entry ID without an asset server"; a non-`file:` ID is returned as `{ href: sourceId, exportName }`.
  `clientEntry`'s documented default format is `"/js/module.js#ExportName"`.
  https://github.com/remix-run/remix/blob/main/packages/render-middleware/src/lib/render-ui.ts ,
  https://github.com/remix-run/remix/blob/main/packages/component/src/runtime/client-entries.ts
- So SSR on a Worker is possible only if client modules are pre-built by a non-Remix tool and
  referenced by public URL (`clientEntry('/assets/summary.js#Summary', ...)`), with the import map
  and preloads authored by hand. No Remix documentation describes that path.

### Workers Static Assets configuration

- `assets.directory` + `binding: "ASSETS"` upload a folder and expose `env.ASSETS.fetch(request)`;
  by default a request matching an asset is served "without invoking the Worker"; `run_worker_first`
  (`true` or an array such as `["/api/*", "!/api/docs/*"]`, max 100 entries) inverts that;
  `not_found_handling: "single-page-application"` returns `index.html` with 200.
  https://developers.cloudflare.com/workers/static-assets/ ,
  https://developers.cloudflare.com/workers/static-assets/binding/ ,
  https://developers.cloudflare.com/workers/static-assets/routing/worker-script/
- SPA routing nuance: with a Worker present and a compatibility date >= 2025-04-01, "navigation
  requests will not invoke the Worker script" (requests carrying `Sec-Fetch-Mode: navigate` get
  `index.html`); client `fetch()` calls still reach the Worker; `run_worker_first: ["/api/*"]`
  forces API paths to the Worker. https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/
- Assets are served from local disk during `wrangler dev`. https://developers.cloudflare.com/workers/development-testing/
- Cloudflare's Vite plugin tutorial builds a SPA + Worker API into `dist/` (`client/` plus Worker
  code and a snapshot `wrangler.json`) with `wrangler.jsonc` `main: "./worker/index.ts"` and
  `assets.not_found_handling: "single-page-application"`; `vite preview` and `wrangler deploy`
  consume the output. https://developers.cloudflare.com/workers/vite-plugin/tutorial/

## 6. Local development on Workers

- Remix (Node): `npm run dev` = `node --watch --import remix/node-tsx server.ts` (process restart on
  change); `npm run hmr` = `node hmr.ts`, which uses `remix/node-hmr` `run('server.ts', { nodeArgs: ['--import','remix/node-tsx','--import','remix/component-hmr/node'], browserHmrChannel })`
  behind a `createFetchProxy` so the public port stays stable while the child restarts; the browser
  entry listens for `import.meta.hot.on('server:update')` and reloads the top frame.
  https://github.com/remix-run/remix/blob/main/template/package.json ,
  https://github.com/remix-run/remix/blob/main/template/hmr.ts ,
  https://github.com/remix-run/remix/blob/main/template/app/actions/public/entry.ts
- `node-hmr` "server side is Node-only. The runner, the child process, and `remix/node-hmr/runtime`
  all depend on Node, and importing the runtime outside a `node-hmr` child process throws."
  https://github.com/remix-run/remix/blob/main/packages/node-hmr/README.md
- `remix` CLI commands are `new`, `routes`, `doctor`, `test`, `version`, `completion`; there is no
  `remix dev`/`remix build`. https://guides.remix.run/cli-and-tooling/ ,
  https://github.com/remix-run/remix/blob/main/packages/remix/README.md
- Cloudflare: `wrangler dev` runs the Worker "on your machine using Miniflare, which runs the same
  `workerd` runtime as production"; bindings are simulated locally; `--remote` uploads to a preview
  environment; `vite dev` with the Cloudflare Vite plugin "also uses Miniflare" and offers Vite HMR.
  https://developers.cloudflare.com/workers/development-testing/ ,
  https://developers.cloudflare.com/workers/vite-plugin/
- `wrangler dev` flags include `--local`, `--remote`, `--assets`, `--port`, `--ip`, `--env`,
  `--var`; the config key `build.watch_dir` is "The directory to watch for changes while using
  `wrangler dev`". Neither page states what happens after a change is detected.
  https://developers.cloudflare.com/workers/wrangler/commands/workers/ ,
  https://developers.cloudflare.com/workers/wrangler/configuration/

Practical loop for SCC on a Worker: run `wrangler dev` (or `vite dev` + Cloudflare plugin for the
SPA variant); Remix's own `node --watch`/`node-hmr` loop cannot be used because the Worker entry is
not a Node `http` server.

## Hard blockers for one Worker serving UI + API

Not empty. One hard blocker and two notable gaps:

1. **Server-rendered, hydrated Remix v3 UI from a Worker has no supported asset pipeline.**
   `remix/assets` (the only thing that turns `clientEntry(import.meta.url, ...)` into browser
   module URLs, import maps, and preloads) is Node-only: on-demand compilation with native
   oxc/lightningcss, `chokidar` file watching, `process.cwd()`, disk caches
   (https://github.com/remix-run/remix/blob/main/packages/assets/package.json ,
   https://github.com/remix-run/remix/blob/main/packages/assets/README.md); Workers' `node:fs` is
   virtual and `fs.watch` is unsupported (https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/).
   Remix documents no ahead-of-time build that emits those modules to a directory
   (https://guides.remix.run/files-and-assets/). The escape hatch (public-URL client entries,
   https://github.com/remix-run/remix/blob/main/packages/render-middleware/src/lib/render-ui.ts)
   requires SCC to own a bundling/compile step for `remix/component` client code plus hand-authored
   import maps; it is undocumented. Until Remix ships a build/export path, "one Worker serving SSR
   UI + API" means owning that toolchain.
2. **Not a blocker, but a constraint:** the SPA path (`remix/spa` + Vite, as in `demos/spa`)
   works with Workers Static Assets and keeps the API in the same Worker (`run_worker_first: ["/api/*"]`,
   https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/). It is
   a React -> Remix component swap and a Hono -> `remix/router` swap, not a move to SSR. The current
   `ssr: false` architecture carries over.
3. **Not a blocker, but a risk:** the guides for Files and Assets, CLI and Tooling, and Production
   are marked "unfinished" (https://guides.remix.run/files-and-assets/ ,
   https://guides.remix.run/cli-and-tooling/ , https://guides.remix.run/production/), and the repo
   README says Remix 3 "is under active development" (https://github.com/remix-run/remix).

Everything else SCC's backend needs (per-request `env`, `request.cf.country`, early-return
middleware scoped to `/api/*`, CORS, JSON responses, 405 handling) is covered by `remix/router`
plus Cloudflare's documented `env`/`cf` behaviour with no wrapper.

## Open questions / unverified

- Whether `wrangler dev` rebuilds and reloads the Worker automatically on save. Cloudflare pages I
  read define `build.watch_dir` and the `dev` flags but do not state the reload behaviour; the
  `--live-reload` flag was not present on the Workers commands page I fetched.
- What `import.meta.url` evaluates to inside a Wrangler-bundled Worker. Not found on
  developers.cloudflare.com. It only matters for `clientEntry(import.meta.url, ...)`, which already
  needs the Node asset server, so it does not change the blocker above.
- Whether `new Request(request)` preserves `cf` in workerd. Irrelevant for the documented entry
  (`router.fetch(request)` keeps the original object) but relevant if SCC ever passes `init`.
- Exact `redirect` export: the Forms guide imports `redirect(..., 303)` from
  `remix/response/redirect`; the fetch-router README names `createRedirectResponse(url)`. I did not
  open the `response` package source to confirm both are exported.
- Whether `remix/spa`'s `run(router, ...)` honours `defaultHandler`-driven 404 statuses and
  redirects the way the README says ("keeps ... redirects, status codes") for `POST` form
  submissions that return `redirect()`; the SPA demo's form action re-renders rather than
  redirecting, so the redirect path is untested here.
- Whether Miniflare's fetched `cf` object reflects the developer's real geolocation (it is fetched
  "from a trusted Cloudflare endpoint" and cached; the page does not say which IP it describes).
- Whether `remix/middleware/compression`, `remix/middleware/session`, and the session storages run
  on Workers. The guide says compression uses Node APIs; I did not check the others. SCC does not
  use them today.
- The claim that Remix v3 is a "forked Preact": not supported by the repository. The runtime has no
  Preact dependency; one file adapts Preact's `dom.d.ts` types. No remix.run page mentions React or
  Preact.
