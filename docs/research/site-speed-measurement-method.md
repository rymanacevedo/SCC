# Site-speed measurement method for the Remix v3 before/after

Resolves GitHub issue #179 (map #174). Consumers: #180 (runs the Runbook) and #183.

Researched 2026-10-12 against primary sources: the Lighthouse and Lighthouse CI repos
and the Lighthouse 13.5.0 package as installed by `bunx` on this machine, web.dev Web
Vitals pages, Cloudflare and Netlify docs, the curl manual, and this repo's own code.
Every claim links to its source; anything that could not be confirmed is listed in
"Open questions / unverified" at the end.

## Summary

- **Toolset.** `bunx lighthouse` (13.5.0) and `bunx @lhci/cli@0.15.1` both resolve and
  run here (confirmed 2026-10-12). Lighthouse needs Node 22+ and a Chrome binary; this
  machine has Node 22.23.2 and no Chrome, so the Runbook installs Chrome for Testing
  with `bunx @puppeteer/browsers install chrome@stable` and passes it via `CHROME_PATH`.
  Variance is reduced by: simulated throttling (the default), 5 runs per URL with the
  LHCI "representative" (median) run, no concurrent collections, and a dedicated
  machine with no extensions. Mobile = Lighthouse default (`mobileSlow4G`, 4x CPU);
  desktop = `--preset=desktop` (`desktopDense4G`, 1x CPU).
- **Metrics.** Compare on the user-facing outcome metrics first: FCP, LCP, CLS, TBT
  (lab proxy for INP), Speed Index. Report TTFB (`server-response-time`) and total
  transferred bytes / script bytes as *diagnostics*, because an SSR app is expected to
  trade a higher TTFB for a lower FCP/LCP (web.dev says exactly this). INP itself is
  only measurable with interactions (Lighthouse timespan mode); TTI is hidden from the
  report since Lighthouse 10 but still present in the JSON (`audits.interactive`).
- **Pages.** Two tiers. Tier 1 (cold navigations, no app state): `/`, `/experience`,
  `/summary`, `/resume` on mobile and desktop. On the Netlify SPA all four resolve to
  the same `index.html` (`/* /index.html 200`), so they measure shell cost; after the
  migration they are real server renders. Tier 2 (seeded user flow via the Lighthouse
  Node API + Puppeteer): `/summary` with experience in `sessionStorage` so the AI POST
  actually fires, and `/resume` with a typing timespan in the Lexical editor (INP/TBT).
  Mock the AI call in Lighthouse runs (deterministic fixture via Puppeteer request
  interception, with `--blocked-url-patterns` as the verified fallback); measure the
  live model separately.
- **API latency.** Measure `POST /api/summaries` with curl `--write-out` timings
  (`time_starttransfer`, `time_total`) against (a) a local `wrangler dev --local` Worker
  and (b) the deployed edge, both with `OPENAI_BASE_URL` pointed at a stub that answers
  the OpenAI **Responses API** (`POST {base}/responses`), which is what
  `@ai-sdk/openai@3.0.74` calls by default. First-request-after-deploy vs. steady state
  gives cold vs. warm; Cloudflare's per-Worker CPU-time and wall-time quantiles are the
  cross-check.
- **Storage.** `docs/perf/<git tag>/` (tag used verbatim, so `baseline/pre-remix-v3`
  nests as `docs/perf/baseline/pre-remix-v3/`) containing `meta.json`, raw LHCI output
  per form factor and page, `api/*.jsonl`, `bundle/sizes.json`, and a `summary.json` +
  `summary.md` pair. Shared scripts live in `docs/perf/tools/`.
- **Field data.** Cloudflare Web Analytics is free, works for sites not proxied by
  Cloudflare via a JS beacon, and reports LCP, INP and CLS; it can be added to the
  Netlify site today and carried over after the move, giving one RUM source across the
  migration. Netlify Web Analytics is server-log based and has no Web Vitals; Netlify
  Real User Monitoring has Web Vitals but is Pro/Enterprise. CrUX will almost certainly
  have no data for this origin (popularity threshold).

## 1. Toolset

### What runs here

- `bunx lighthouse --version` printed `13.5.0` (run 2026-10-12 in this worktree).
  `bunx @lhci/cli@0.15.1 collect --help` and `upload --help` also ran. `bunx` honours the
  `#!/usr/bin/env node` shebang in `lighthouse/cli/index.js` and runs it under Node
  unless `--bun` is passed ([bunx docs](https://bun.sh/docs/cli/bunx): "By default, Bun
  respects shebangs. If an executable is marked with `#!/usr/bin/env node`, Bun spins up
  a `node` process"). Do **not** pass `--bun`.
- Lighthouse requires "Node 22 (LTS) or later" and an installed Chrome
  ([readme](https://github.com/GoogleChrome/lighthouse/blob/main/readme.md)); the
  installed package declares `"node": ">=22.19"` (`package.json` in
  `~/.bun/install/cache/lighthouse@13.5.0`). Local Node is v22.23.2.
- No Chrome binary is on `PATH` here (checked `google-chrome`, `chromium`, flatpak).
  `@puppeteer/browsers install chrome@stable` downloads Chrome for Testing and "outputs
  the actual browser buildId that was installed and the absolute path to the browser
  executable (see --format)"; `--path` defaults to the current working directory
  (`bunx @puppeteer/browsers install --help`, run 2026-10-12;
  [pptr.dev/browsers-api](https://pptr.dev/browsers-api)). Lighthouse picks the binary
  from the `CHROME_PATH` environment variable
  ([readme](https://github.com/GoogleChrome/lighthouse/blob/main/readme.md)); LHCI
  resolves the `chromePath` option, then `CHROME_PATH`, then a puppeteer install, then
  chrome-launcher
  ([LHCI configuration](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md)).

### Lighthouse CLI vs. Lighthouse CI

- Lighthouse CLI flags that matter (`cli/cli-flags.js` in 13.5.0 and the
  [readme](https://github.com/GoogleChrome/lighthouse/blob/main/readme.md)):
  `--output=json,html`, `--output-path` ("If using multiple outputs, --output-path is
  appended with the standard extension for each output type"), `--preset=desktop`
  (the readme says to use the preset rather than `--form-factor=desktop`),
  `--only-categories=performance`, `--chrome-flags="--headless"`,
  `--blocked-url-patterns` ("Block any network requests to the specified URL
  patterns"), `--disable-storage-reset`, `--throttling-method=simulate|devtools|provided`,
  `--throttling.*`.
- LHCI adds the run count and median selection for free: `lhci collect --url=<u> -n 5`
  runs Lighthouse 5 times per URL ("`numberOfRuns` ... Default is 3"), and
  `lhci upload --target=filesystem --outputDir=<dir>` writes every report plus a
  `manifest.json` whose entries carry `url`, `isRepresentativeRun` ("whether it's the
  median run"), `htmlPath`, `jsonPath` and a `summary` of category scores
  ([LHCI configuration](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md);
  flags confirmed in `lhci upload --help`: `--target` choices `lhci`,
  `temporary-public-storage`, `filesystem`). Lighthouse flags pass through
  `--settings.<flag>`; the LHCI docs' own example sets `"preset": "desktop"` under
  `settings`. `lhci collect` clears its `.lighthouseci` scratch directory on every run
  unless `--additive` is given, so the Runbook uploads after each collect.
- Lighthouse's own variability doc recommends exactly this: "The median Lighthouse score
  of 5 runs is twice as stable as 1 run", suggested via `lhci collect -n 5` or
  `computeMedianRun` from `lighthouse/core/lib/median-run.js` (file present in 13.5.0)
  ([variability.md](https://github.com/GoogleChrome/lighthouse/blob/main/docs/variability.md)).

### Variance-reduction settings

From [variability.md](https://github.com/GoogleChrome/lighthouse/blob/main/docs/variability.md):

- Hardware: "at least 2 dedicated cores (4 recommended) and 2GB RAM (4-8GB
  recommended)"; avoid burstable/shared instances.
- "Don't run concurrent collections" on one machine.
- Isolate external factors: no browser extensions or antivirus on the test client; if
  local resources are limited, use a hosted lab (PageSpeed Insights / WebPageTest).
- Aggregate: median (or p90/min/max) of multiple runs, never a single run.
- Simulated throttling mitigates local-network, tier-1-network, hardware, contention and
  browser nondeterminism better than DevTools throttling; neither mitigates page
  nondeterminism or web-server variability.

Throttling presets ([throttling.md](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md)
and `@paulirish/trace_engine/models/trace/lantern/simulation/Constants.js` as pulled in
by Lighthouse 13.5.0):

| Preset | rttMs | throughputKbps | cpuSlowdownMultiplier | Used by |
|---|---|---|---|---|
| `mobileSlow4G` (default) | 150 | 1.6 x 1024 | 4 | mobile runs (`lighthouse <url>`) |
| `desktopDense4G` | 40 | 10 x 1024 | 1 | `--preset=desktop` (`core/config/desktop-config.js`) |

"Simulated (default): Lighthouse uses a simulation of a page load, based on the data
observed in the initial unthrottled load. It is fast and deterministic" and "matches
PageSpeed Insights and the CLI default" ([throttling.md](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md)).
Keep the default; do not switch to `devtools`/`provided` for this comparison.

Additional fairness rules for this project (derived from the above):

- Run before and after from the **same machine, same network, same Chrome build**, with
  `meta.json` recording all three. Lighthouse's scoring doc: "When your Performance score
  fluctuates it's usually because of changes in underlying conditions"
  ([performance-scoring](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring)).
- Run mobile and desktop as separate collections; CWV guidance segments thresholds "across
  mobile and desktop devices" ([web.dev/vitals](https://web.dev/articles/vitals)).
- Run both tags within the same session where possible (baseline from the deployed
  Netlify site, "after" from the deployed Worker) so network conditions match.

### Hosted alternatives (optional)

- PageSpeed Insights API (`https://www.googleapis.com/pagespeedonline/v5/runPagespeed`,
  "can be used with or without an API key") returns `lighthouseResult` lab data from
  Google's infrastructure, which removes local-hardware variance
  ([PSI get-started](https://developers.google.com/speed/docs/insights/v5/get-started)).
  LHCI exposes this as `lhci collect --method=psi --psiApiKey=... --psiStrategy=mobile|desktop`
  (`lhci collect --help`). Useful as a second opinion, not as the primary method,
  because PSI's throttling/hardware are not under our control.
- WebPageTest: `docs.webpagetest.org` was unreachable on 2026-10-12 (TLS certificate
  is for `*.netlify.app`), so only the Catchpoint mirror of the legacy API doc could be
  read: "WebPageTest requires an API key to submit any test using the API", `runs` is
  "1-9 on the public instance", `fvonly=1` skips Repeat View and "Each repeat view test
  counts as another test run against your API limit"
  ([Catchpoint mirror](https://docs.catchpoint.com/wpt/docs/webpagetest-legacy-api.md)).
  Whether the free Starter plan includes API access could not be confirmed; treat WPT
  as manual-only and optional.

## 2. Metrics that matter, and which are fair across rendering models

Definitions and thresholds (all 75th-percentile, field guidance):

| Metric | Good | Poor | Lab/field | Source |
|---|---|---|---|---|
| TTFB | <= 0.8 s | > 1.8 s | both; not a CWV | [web.dev/ttfb](https://web.dev/articles/ttfb) |
| FCP | <= 1.8 s | > 3.0 s | both | [web.dev/fcp](https://web.dev/articles/fcp) |
| LCP | <= 2.5 s | (CWV) | both | [web.dev/vitals](https://web.dev/articles/vitals) |
| INP | <= 200 ms | > 500 ms | field; lab only with interactions | [web.dev/inp](https://web.dev/articles/inp) |
| TBT | < 200 ms on "average mobile hardware" | | lab | [web.dev/tbt](https://web.dev/articles/tbt) |
| CLS | <= 0.1 | (CWV) | both | [web.dev/vitals](https://web.dev/articles/vitals) |

Lighthouse 13.5.0 performance score weights (`core/config/default-config.js`): FCP 10,
LCP 25, TBT 30, CLS 25, SI 10; `interaction-to-next-paint` weight 0; `interactive` (TTI)
weight 0 in the `hidden` group. The changelog for 10.0.0: "Time to Interactive (TTI) no
longer contributes to the performance score and is not displayed in the report. However,
it is still accessible in the Lighthouse result JSON"
([changelog.md](https://github.com/GoogleChrome/lighthouse/blob/main/changelog.md)).

How each behaves across a client-rendered SPA and a server-rendered app:

- **TTFB / `server-response-time`.** Lighthouse's audit measures "the time that it takes
  for a user's browser to receive the first byte of page content" for the main document
  and "fails when the browser waits more than 600 ms"; it excludes DNS and redirects
  ([TTFB audit doc](https://developer.chrome.com/docs/lighthouse/performance/time-to-first-byte);
  `TARGET_MS = 100` in `core/audits/server-response-time.js`). On the Netlify SPA every
  route is the same static `index.html` (`packages/frontend/public/_redirects` is
  `/* /index.html 200`, which is the pattern React Router's SPA guide prescribes:
  [SPA mode](https://reactrouter.com/how-to/spa)), so TTFB is CDN cache time and is the
  same for all four pages. After the migration each route is rendered by the Worker, so
  TTFB will include render time. web.dev is explicit that this is a trade, not a
  regression: a server-rendered site "could have a higher TTFB, but better FCP and LCP
  values than an entirely client-rendered experience", while for SPAs "achieving the
  lowest possible TTFB is especially important so that the client-rendering of markup can
  occur sooner" ([web.dev/ttfb](https://web.dev/articles/ttfb)). **Report TTFB, but do
  not score the migration on it.**
- **FCP and LCP.** Paint-based, independent of how the pixels got there. These are the
  primary comparison metrics. Note the SPA baseline: React Router SPA mode "pre-renders
  your root route at build time into an index.html" and "will only render the root route
  so that it is capable of hydrating at runtime for any path"
  ([SPA mode](https://reactrouter.com/how-to/spa)), so the baseline's FCP on `/summary`
  is whatever the root shell paints, and LCP waits for JS + the client loader.
- **TBT and INP.** TBT "is a metric that should be measured in the lab" and "may be a
  reasonable proxy metric for INP for the lab but it's not a substitute"
  ([web.dev/tbt](https://web.dev/articles/tbt)); Lighthouse "cannot measure INP, as there
  is no user input" in a plain navigation ([web.dev/vitals](https://web.dev/articles/vitals)).
  In 13.5.0 `interaction-to-next-paint` has `supportedModes: ['timespan']`, so INP only
  appears from a user-flow timespan with real interactions. Both rendering models pay
  hydration cost on the main thread, so TBT is fair. Watch for the SSR app shipping
  *more* JS (hydration of a full page vs. a shell) - that shows up here and in bytes.
- **CLS.** Fair across models; expect SSR to reduce shifts caused by late-loading client
  content on the builder pages. Lab CLS "only considers layout shifts that occur above the
  fold and during load" ([lab vs field](https://web.dev/articles/lab-and-field-data-differences)).
- **Transferred bytes.** `total-byte-weight` reports `numericValue` = sum of
  `transferSize` over network records (`numericUnit: 'byte'`), and `resource-summary`
  breaks transfer size down by `resourceType` (`script`, `document`, `stylesheet`, ...)
  (`core/audits/byte-efficiency/total-byte-weight.js`, `core/audits/resource-summary.js`).
  Compare **script bytes** and **document bytes** separately: SSR grows the document and
  may shrink or grow script; the total alone would hide that.
- **JS bundle size (build-time).** Independent of the network; captured from
  `bun run build` output in `packages/frontend` (`react-router build` with
  `buildDirectory: 'dist'`, so client assets land in `dist/client`; React Router's SPA
  guide deploys `build/client`, which is this project's `dist/client`
  ([react-router.config.ts reference](https://reactrouter.com/api/framework-conventions/react-router.config.ts),
  [SPA mode](https://reactrouter.com/how-to/spa))). After the migration the equivalent
  is whatever the Remix v3 build emits as client assets - record raw and gzip sizes of
  every `.js` and `.css` and the sum.
- **Time to Interactive.** Available as `audits.interactive.numericValue` in navigation
  mode only (`supportedModes: ['navigation']`). Report it as secondary; it is no longer
  scored and is "overly sensitive to outlier network requests and long tasks"
  ([What's new in Lighthouse 10](https://developer.chrome.com/blog/lighthouse-10-0)).

Decision rule for #183: the migration is a win if, per page and form factor, median LCP,
FCP, TBT and CLS do not regress and script bytes do not grow materially; a higher TTFB is
acceptable if LCP/FCP improve.

## 3. Pages to measure, and the AI call

### Which pages, in which mode

Routes (`packages/frontend/app/routes.ts`): `/` -> `routes/home.tsx`, `/experience`,
`/summary`, `/resume`. App state lives in `window.sessionStorage` under the key `user`
(`packages/frontend/app/utils/user.ts: getUser()`), validated by `UserSchema`.

- `/summary` only fires the AI request if the user has experience:
  `clientLoader` builds `experienceString` from `user.experience`, and the component's
  `useEffectOnce` calls `fetcher.submit(..., { action: '/api/summary' })` only
  `if (experienceString)` (`packages/frontend/app/routes/builder/summary.tsx`). The in-app
  `/api/summary` client action then POSTs to `${VITE_HONO_BACKEND_URL}/api/summaries`
  (`routes/api/summary.tsx` -> `utils/suggestions.ts: proxySuggestions`), and any
  failure degrades to `{ error: 'Suggestions are unavailable.' }` instead of throwing.
- `/resume` renders `<Editor user={user} />` (Lexical `LexicalComposer` +
  `RichTextPlugin` + `ContentEditable`) from `getUser()`.

Lighthouse CLI/LHCI open their own tab, and `sessionStorage` is per tab, so plain
navigations are always **unseeded**. Lighthouse's default storage reset clears
`['file_systems', 'shader_cache', 'service_workers', 'cache_storage']` plus the browser
cache (`core/config/constants.js`, `core/gather/driver/storage.js`); it does not list
session storage, but that is moot for a fresh tab.

Therefore two tiers:

1. **Tier 1 - cold, unseeded navigations** of `/`, `/experience`, `/summary`, `/resume`,
   mobile and desktop, 5 runs each via LHCI. This is the apples-to-apples shell/route
   cost and the only tier that produces a Performance score. (Unseeded `/summary` does
   not call the AI; unseeded `/resume` renders an empty editor.)
2. **Tier 2 - seeded user flow** with the Lighthouse Node API, which is the only way to
   "analyze a multi-step flow" and the only mode that yields INP: the Puppeteer `page`
   is shared, so the script sets `sessionStorage.user` after a first `page.goto(origin)`,
   then `flow.navigate(origin + '/summary')` (AI request fires),
   `flow.navigate(origin + '/resume')`, then `flow.startTimespan()` / type into the
   `contenteditable` / `flow.endTimespan()` ([user-flows.md](https://github.com/GoogleChrome/lighthouse/blob/main/docs/user-flows.md)).
   Flow navigations default to `skipAboutBlank = true`, and "On repeat navigations, we
   want to disable storage reset by default (i.e. it's not a cold load)"
   (`core/user-flow.js: _getNextNavigationFlags`), so the second navigation in the flow is
   a warm load - record it as such. Pass `config: desktopConfig` (exported from
   `lighthouse`, `core/index.js`) for the desktop variant.

### Mock or live AI?

Mock it inside Lighthouse runs. Reasons, all from primary sources:

- Lighthouse cannot mitigate "page nondeterminism" or "web server variability"
  ([variability.md](https://github.com/GoogleChrome/lighthouse/blob/main/docs/variability.md));
  a live model call is both.
- The AI result is rendered into the page (example cards), so blocking the request
  changes what is painted; a fixture keeps the painted output identical before and
  after, which is what the comparison needs.
- Live calls spend real tokens 10+ times per page per form factor.

Two mechanisms:

- **Preferred (Tier 2 flow):** Puppeteer `page.setRequestInterception(true)` and
  `request.respond(...)` for `POST .../api/summaries` with a fixed JSON body matching the
  backend's `{ title, text }[]` shape (`packages/backend/src/services/ai.ts:
  createSummaries` returns `output.summaries`). Puppeteer: "Activating request
  interception enables HTTPRequest.abort(), HTTPRequest.continue() and
  HTTPRequest.respond() methods" ([pptr.dev](https://pptr.dev/api/puppeteer.page.setrequestinterception)).
  Interplay with Lighthouse's own CDP session is **unverified** (see Open questions);
  if the flow hangs, fall back to the next option.
- **Fallback (verified flag):** `--blocked-url-patterns='*/api/summaries'` on the CLI
  (or `--settings.blockedUrlPatterns` in LHCI). The page then renders the degraded
  `{ error }` state deterministically.

Measure the **live** model separately, once, in the API step (section 4) with 5 samples,
purely to document end-to-end latency; it is not part of the before/after score.

## 4. Isolating Worker API overhead for `/api/summaries`

### What the route does

`POST /api/summaries` (`packages/backend/src/index.ts`) runs geo restriction
(`c.req.raw.cf?.country` must be in `ALLOWED_COUNTRIES`, else 403), CORS, Zod validation
of `{ prompt }`, `validateOpenAiEnvironment` (`OPENAI_API_KEY` required,
`OPENAI_BASE_URL` optional URL, `OPENAI_MODEL` optional; `packages/backend/lib/environment.ts`),
`resolveModel` -> `createOpenAI({ apiKey, baseURL })` (`services/model.ts`), then
`generateText` with `Output.object`.

### What the stub must speak

`@ai-sdk/openai@3.0.74` (`node_modules/@ai-sdk/openai/dist/index.mjs`): the default
provider function `openai(modelId)` calls `createResponsesModel`, which issues
`POST ${baseURL}/responses` (`url({ path: "/responses" })`); the default `baseURL` is
`https://api.openai.com/v1`. The non-streaming response is parsed with
`openaiResponsesResponseSchema`, whose minimum shape for a text answer is:

```json
{
  "id": "resp_perf",
  "output": [
    { "type": "message", "role": "assistant", "id": "msg_perf",
      "content": [ { "type": "output_text", "text": "<JSON string>", "annotations": [] } ] }
  ],
  "usage": { "input_tokens": 1, "output_tokens": 1 }
}
```

(`annotations` is a required array; `usage` is optional but included so token
accounting does not warn.) The `text` must be the JSON object the route expects:
`{"summaries":[{"title":"...","text":"..."}]}`.

### Where to run the Worker

- **Local (framework overhead only):** `wrangler dev --local` runs the Worker in
  workerd on this machine; `--var` injects `key:value` pairs and `.dev.vars` /
  `.dev.vars.<env>` supply local secrets ("If `.dev.vars.<environment-name>` exists then
  only this will be loaded")
  ([wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/workers/),
  [environment variables](https://developers.cloudflare.com/workers/configuration/environment-variables/)).
  With the stub on localhost, `time_starttransfer` is Hono routing + validation + AI SDK
  request/response handling + the loopback hop. This is the number that isolates
  backend-framework overhead, and it is identical before/after unless the Remix v3 move
  changes the API layer.
- **Edge (cold/warm):** deploy a `perf` environment
  (`"env": { "perf": { "vars": { ... } } }` in `wrangler.jsonc`; `vars` are
  non-inheritable so every var must be repeated; the Worker is named
  `<name>-<env>` = `scc-backend-perf`;
  [environments](https://developers.cloudflare.com/workers/wrangler/environments/)).
  The stub must then be reachable from Cloudflare, so deploy it as a second tiny Worker
  (free plan: 100,000 requests/day, 10 ms CPU per request
  [limits](https://developers.cloudflare.com/workers/platform/limits/)). Workers run in
  V8 isolates that "can start around a hundred times faster than a Node process" and a
  "given isolate is not necessarily long-lived"
  ([how Workers works](https://developers.cloudflare.com/workers/reference/how-workers-works/));
  there is no documented way to force a cold start, so **cold = first request after
  `wrangler deploy --env perf`, warm = subsequent requests**, and the `cf-ray` suffix
  ("a three-letter code corresponding to the data center's location",
  [HTTP headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/))
  is recorded so cross-colo samples can be excluded.
- **Cross-check:** the Workers dashboard exposes per-Worker "CPU Time per execution ...
  broken down into relevant quantiles" and "Wall time ... elapsed time in milliseconds
  between the start of a Worker invocation" for up to three months
  ([metrics and analytics](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/)).
  Screenshot or GraphQL-export the p50/p99 CPU and wall time for the measurement window.

### How to time it

curl `--write-out` (curl 8.18.0 here; definitions from `man curl`):
`time_namelookup` "until the name resolving was completed", `time_connect` "until the TCP
connect ... was completed", `time_appconnect` "until the SSL/SSH/etc connect/handshake
... was completed", `time_starttransfer` "until the first byte was received. This
includes time_pretransfer and also the time the server needed to calculate the result",
`time_total` "the full operation lasted", `response_code`, `size_download`.
`%header{cf-ray}` was verified live on 2026-10-12 against a Cloudflare-fronted host.
Server-side time is approximately `time_starttransfer - time_appconnect` (for the local
Worker there is no TLS, so `time_starttransfer - time_connect`). Take 30 samples and
report min / p50 / p95 / max with `jq`.

## 5. Where results live: `docs/perf/`

Convention (new; the repo has only `docs/agents/` and `docs/research/` today):

```
docs/perf/
  README.md                         # this layout + how to regenerate, written by #180
  tools/                            # shared, versioned scripts (no results here)
    package.json                    # lighthouse + puppeteer for the flow script
    flow.mjs                        # Tier 2 seeded user flow
    user-fixture.json               # sessionStorage `user` seed (UserSchema-valid)
    summaries-fixture.json          # mocked /api/summaries response
    summaries-request.json          # { "prompt": "<job>...</job>" } body for curl
    openai-stub.ts                  # Bun server: POST */responses -> fixed Responses body
    openai-stub-worker/             # same stub as a deployable Worker (edge runs only)
    extract-summary.sh              # LHR manifests -> summary.json / summary.md
  <git tag, verbatim>/              # e.g. docs/perf/baseline/pre-remix-v3/
    meta.json                       # tag, commit, date, origins, lighthouse/chrome/node versions, host
    lighthouse/
      mobile/{home,experience,summary,resume}/   # lhci filesystem upload: manifest.json + *.report.{json,html}
      desktop/{home,experience,summary,resume}/
      flows/run-{1,2,3}/flow-{mobile,desktop}-mock.{json,report.html}
    api/
      summaries-local-stub.jsonl    # 30 samples, wrangler dev --local + local stub
      summaries-edge-stub.jsonl     # 30 samples, scc-backend-perf + stub Worker (optional)
      summaries-live.jsonl          # 5 samples, real model (documentation only)
      crux-origin.json              # CrUX probe response (expected: no data)
    bundle/
      build.log                     # full `bun run build` output
      sizes.json                    # per-file raw + gzip bytes and totals
    summary.json                    # one object per (page, formFactor): medians of each metric + api percentiles + bundle totals
    summary.md                      # the same as a table for humans / the PR
```

Why key by tag: `git describe --tags --exact-match HEAD` fails unless HEAD is tagged, so
the Runbook refuses to run on an untagged commit and the directory name is guaranteed to
match a commit. `baseline/pre-remix-v3` already exists (`git tag -l`). Diffing two runs
is `diff <(jq -S . docs/perf/baseline/pre-remix-v3/summary.json) <(jq -S . docs/perf/<after>/summary.json)`.

Why JSON + Markdown: `summary.json` is the machine-diffable artefact (and the input to
#183); `summary.md` is what gets pasted into the issue. The raw LHRs (one per run) are
kept so any metric can be re-derived; the HTML reports are kept for humans. Expect ~40
LHR JSON files per tag (4 pages x 2 form factors x 5 runs), a few hundred KB each; if
that is too heavy for git, keep `manifest.json` + the representative run's JSON only and
note the omission in `meta.json`.

`.lighthouseci/` (LHCI scratch) must not land in the repo: the Runbook runs LHCI from
`/tmp/scc-lhci`.

## 6. Free real-user (field) signal

- **Cloudflare Web Analytics** - "Privacy-first analytics for your website without
  changing DNS or using Cloudflare proxy", "Available on all plans"
  ([overview](https://developers.cloudflare.com/web-analytics/)); the product page says
  "for free" ([cloudflare.com/web-analytics](https://www.cloudflare.com/web-analytics/)).
  Setup for a non-proxied site: add the hostname in the dashboard, copy the JS snippet
  from **Manage site**, paste it "before the ending body tag"
  ([get started](https://developers.cloudflare.com/web-analytics/get-started/)). It
  reports LCP, INP and CLS via "its lightweight JavaScript beacon", rated Good / Needs
  Improvement / Poor; CLS is Chromium-only
  ([Core Web Vitals](https://developers.cloudflare.com/web-analytics/data-metrics/core-web-vitals/)).
  Limit: 10 non-proxied sites ([limits](https://developers.cloudflare.com/web-analytics/limits/)).
  Recommendation: add the beacon to `sccc.netlify.app` now so the baseline has field
  data, keep the same site entry after the move (the hostname will change if the Worker
  serves a different domain - add it as a second site). Retention was not stated in the
  docs read.
- **Netlify Web Analytics** - "Data for Web Analytics comes from our Content Delivery
  Network (CDN) server logs. Since there's no client-side code involved", hourly updates,
  never sampled ([how it works](https://docs.netlify.com/manage/monitoring/web-analytics/how-web-analytics-works/)).
  Metrics are pageviews, unique visitors, top pages/sources/locations, 404s, bandwidth -
  no timing and no Web Vitals ([site analytics](https://docs.netlify.com/monitor-sites/site-analytics/)).
  Not useful for speed.
- **Netlify Real User Monitoring** - collects LCP, INP, CLS, FCP (and deprecated FID)
  through an injected `async` snippet on production deploys; "available on all Pro and
  Enterprise plans" with 7/30-day retention by plan
  ([RUM docs](https://docs.netlify.com/monitor-sites/real-user-metrics/)). Not free.
- **Netlify Lighthouse build plugin** - runs Lighthouse per deploy ("mobile-first" by
  default, desktop via `netlify.toml`); "may not be available on all plans"
  ([Lighthouse plugin](https://docs.netlify.com/manage/monitoring/lighthouse/)). Lab, not
  field, and gone after the move; skip.
- **CrUX** - API is "offered without charge" but needs a Google Cloud API key
  ([CrUX API](https://developer.chrome.com/docs/crux/api)); a page/origin must be
  "sufficiently popular ... An exact number is not disclosed"
  ([methodology](https://developer.chrome.com/docs/crux/methodology)). Almost certainly
  empty for this origin; the Runbook includes a one-line probe so it is recorded rather
  than assumed.
- **Cloudflare Workers metrics** - server-side only (CPU/wall time, requests, errors),
  free with the Worker; see section 4.

Field data differs from lab data by design (caches, bfcache, real interactions, LCP
stopping at first interaction; [lab vs field](https://web.dev/articles/lab-and-field-data-differences)),
so field numbers complement but never replace the lab before/after.

## Runbook

Everything below is meant to be run verbatim by #180, from the repo root of a checkout
whose `HEAD` is the tagged commit being measured. Lines starting with `#` are comments.
Steps 0-2 are the same for every tag; step 3 (bundle) and step 5 (API) have "after"
variants noted inline. Do not run anything against production until #180 is in progress.

### 0. One-time machine setup

```bash
# Chrome for Testing (stable) into a fixed cache dir; prints the executable path.
export CHROME_PATH="$(bunx @puppeteer/browsers install chrome@stable --path "$HOME/.cache/scc-perf-chrome" --format '{{path}}')"
"$CHROME_PATH" --version
bunx lighthouse --version
bunx @lhci/cli@0.15.1 --version
node --version    # must be >= 22.19 (Lighthouse 13.5.0 engines)
jq --version
```

### 1. Identify the run

```bash
cd "$(git rev-parse --show-toplevel)"
export PERF_ROOT="$PWD"
export PERF_TAG="$(git describe --tags --exact-match HEAD)"        # aborts if HEAD is not tagged
export PERF_DIR="$PERF_ROOT/docs/perf/$PERF_TAG"
export PERF_ORIGIN="https://sccc.netlify.app"                        # "after": the Worker-served origin
mkdir -p "$PERF_DIR/lighthouse/mobile" "$PERF_DIR/lighthouse/desktop" "$PERF_DIR/lighthouse/flows" "$PERF_DIR/api" "$PERF_DIR/bundle"

jq -n \
  --arg tag "$PERF_TAG" \
  --arg commit "$(git rev-parse HEAD)" \
  --arg date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg origin "$PERF_ORIGIN" \
  --arg lighthouse "$(bunx lighthouse --version)" \
  --arg lhci "$(bunx @lhci/cli@0.15.1 --version)" \
  --arg chrome "$("$CHROME_PATH" --version)" \
  --arg node "$(node --version)" \
  --arg host "$(uname -srm) / $(nproc) cores" \
  '{tag:$tag, commit:$commit, date:$date, origin:$origin, lighthouse:$lighthouse, lhci:$lhci, chrome:$chrome, node:$node, host:$host, throttling:"simulate (lighthouse default; mobileSlow4G / desktopDense4G)", runsPerUrl:5}' \
  > "$PERF_DIR/meta.json"
```

### 2. Tier 1 - Lighthouse navigations (4 pages x 2 form factors x 5 runs)

```bash
mkdir -p /tmp/scc-lhci && cd /tmp/scc-lhci
for page in home experience summary resume; do
  if [ "$page" = home ]; then path="/"; else path="/$page"; fi
  for ff in mobile desktop; do
    out="$PERF_DIR/lighthouse/$ff/$page"; mkdir -p "$out"
    if [ "$ff" = desktop ]; then preset="--settings.preset=desktop"; else preset=""; fi
    bunx @lhci/cli@0.15.1 collect \
      --url="$PERF_ORIGIN$path" \
      --numberOfRuns=5 \
      --chromePath="$CHROME_PATH" \
      --settings.onlyCategories=performance \
      --settings.chromeFlags="--headless=new" \
      $preset
    bunx @lhci/cli@0.15.1 upload --target=filesystem --outputDir="$out"
  done
done
cd "$PERF_ROOT"
```

Extract per-metric medians across the 5 LHRs of each (form factor, page), and note
which run LHCI picked as representative:

```bash
mkdir -p docs/perf/tools
cat > docs/perf/tools/extract-summary.sh <<'SH'
#!/usr/bin/env bash
# Usage: extract-summary.sh <perf-dir>   -> writes <perf-dir>/summary.json and summary.md
# Contract: Lighthouse 13.x audit IDs below; LHCI manifest.json fields url/isRepresentativeRun/jsonPath.
set -euo pipefail
dir="$1"
rows="$(mktemp)"
for manifest in "$dir"/lighthouse/*/*/manifest.json; do
  ff="$(basename "$(dirname "$(dirname "$manifest")")")"
  page="$(basename "$(dirname "$manifest")")"
  rep="$(jq -r '.[] | select(.isRepresentativeRun) | .jsonPath' "$manifest")"
  runs="$(mktemp)"
  jq -r '.[].jsonPath' "$manifest" | while read -r lhr; do
    [ -f "$lhr" ] || lhr="$(dirname "$manifest")/$lhr"
    jq -c '{
      perf: .categories.performance.score,
      ttfb: .audits["server-response-time"].numericValue,
      fcp: .audits["first-contentful-paint"].numericValue,
      lcp: .audits["largest-contentful-paint"].numericValue,
      tbt: .audits["total-blocking-time"].numericValue,
      cls: .audits["cumulative-layout-shift"].numericValue,
      si: .audits["speed-index"].numericValue,
      tti: .audits["interactive"].numericValue,
      bytesTotal: .audits["total-byte-weight"].numericValue,
      bytesScript: ([.audits["resource-summary"].details.items[]? | select(.resourceType=="script") | .transferSize] | add),
      bytesDocument: ([.audits["resource-summary"].details.items[]? | select(.resourceType=="document") | .transferSize] | add)
    }' "$lhr"
  done > "$runs"
  jq -s --arg ff "$ff" --arg page "$page" --arg rep "$(basename "$rep")" '
    def med: map(select(. != null)) | sort
      | if length == 0 then null elif length % 2 == 1 then .[length/2|floor] else (.[length/2-1] + .[length/2]) / 2 end;
    {formFactor:$ff, page:$page, runs:length, representativeRun:$rep,
     median:{perf:(map(.perf)|med), ttfb:(map(.ttfb)|med), fcp:(map(.fcp)|med), lcp:(map(.lcp)|med),
             tbt:(map(.tbt)|med), cls:(map(.cls)|med), si:(map(.si)|med), tti:(map(.tti)|med),
             bytesTotal:(map(.bytesTotal)|med), bytesScript:(map(.bytesScript)|med), bytesDocument:(map(.bytesDocument)|med)}}
  ' "$runs" >> "$rows"
  rm -f "$runs"
done
jq -s '{lighthouse: .}' "$rows" > "$dir/summary.json"
{
  echo "| form factor | page | runs | perf (median) | TTFB ms | FCP ms | LCP ms | TBT ms | CLS | SI ms | TTI ms | bytes total | bytes script | bytes document |"
  echo "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"
  jq -r '.lighthouse[] | [.formFactor, .page, .runs, .median.perf,
      (.median.ttfb|round), (.median.fcp|round), (.median.lcp|round), (.median.tbt|round),
      ((.median.cls*1000|round)/1000), (.median.si|round), (.median.tti|round),
      .median.bytesTotal, .median.bytesScript, .median.bytesDocument]
    | "| " + (map(tostring) | join(" | ")) + " |"' "$dir/summary.json"
} > "$dir/summary.md"
rm -f "$rows"
SH
chmod +x docs/perf/tools/extract-summary.sh
docs/perf/tools/extract-summary.sh "$PERF_DIR"
cat "$PERF_DIR/summary.md"
```

### 3. Bundle size from `bun run build`

```bash
cd "$PERF_ROOT/packages/frontend"
bun run build 2>&1 | tee "$PERF_DIR/bundle/build.log"
# Baseline: client assets are in dist/client (buildDirectory 'dist', ssr:false).
# After: replace dist/client with the Remix v3 client-asset directory and note it in meta.json.
ASSETS=dist/client
find "$ASSETS" -type f \( -name '*.js' -o -name '*.css' \) -print0 \
  | xargs -0 -I{} sh -c 'printf "%s\t%s\t%s\n" "{}" "$(wc -c < "{}")" "$(gzip -c -9 "{}" | wc -c)"' \
  | jq -R -s --arg assets "$ASSETS" '
      split("\n") | map(select(length>0) | split("\t") | {file:.[0], bytes:(.[1]|tonumber), gzipBytes:(.[2]|tonumber)})
      | {assetsDir:$assets, files:., totals:{
          js:  {bytes:(map(select(.file|endswith(".js"))|.bytes)|add),  gzipBytes:(map(select(.file|endswith(".js"))|.gzipBytes)|add)},
          css: {bytes:(map(select(.file|endswith(".css"))|.bytes)|add), gzipBytes:(map(select(.file|endswith(".css"))|.gzipBytes)|add)}}}' \
  > "$PERF_DIR/bundle/sizes.json"
jq '.totals' "$PERF_DIR/bundle/sizes.json"
cd "$PERF_ROOT"
```

### 4. Tier 2 - seeded user flow (`/summary` with AI mocked, `/resume` typing)

One-time files under `docs/perf/tools/` (commit them with the first run):

```bash
mkdir -p docs/perf/tools && cd docs/perf/tools
cat > package.json <<'JSON'
{ "name": "scc-perf-tools", "private": true, "type": "module",
  "dependencies": { "lighthouse": "13.5.0", "puppeteer": "24" } }
JSON
cat > user-fixture.json <<'JSON'
{ "userId": "perf-fixture",
  "experience": [
    { "jobId": "perf-1", "jobTitle": "Warehouse Associate", "employer": "Acme Logistics",
      "city": "Denver", "state": "CO", "startDate": "2021-03-01", "endDate": "2024-06-30",
      "currentlyEmployed": false,
      "details": ["Picked and packed 300+ orders per shift", "Trained 4 new hires on safety procedures", "Operated forklift and pallet jack"] }
  ] }
JSON
cat > summaries-fixture.json <<'JSON'
[ { "title": "Warehouse Associate", "text": "Dependable warehouse associate with three years of experience picking, packing and shipping high volumes of orders accurately. Certified forklift operator who trains new hires on safety procedures and keeps throughput steady under pressure." },
  { "title": "Logistics Team Member", "text": "Detail-oriented logistics team member who consistently exceeds daily order targets while maintaining a clean safety record. Comfortable with pallet jacks, forklifts and inventory scanners, and known for helping teammates during peak season." } ]
JSON
cat > summaries-request.json <<'JSON'
{ "prompt": "<job><jobTitle>Warehouse Associate</jobTitle> <employer>Acme Logistics</employer><details><detail1>Picked and packed 300+ orders per shift</detail1><detail2>Trained 4 new hires on safety procedures</detail2></details></job>" }
JSON
cat > flow.mjs <<'JS'
// Lighthouse user flow: seeded /summary (AI mocked or live) and /resume typing timespan.
// Usage: CHROME_PATH=... node flow.mjs --origin=https://host --out=/dir --formFactor=mobile|desktop --ai=mock|live
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import puppeteer from 'puppeteer';
import {desktopConfig, startFlow} from 'lighthouse';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const {origin, out} = args;
const formFactor = args.formFactor ?? 'mobile';
const ai = args.ai ?? 'mock';
if (!origin || !out) throw new Error('--origin and --out are required');
mkdirSync(out, {recursive: true});
const user = JSON.parse(readFileSync(new URL('./user-fixture.json', import.meta.url), 'utf8'));
const summaries = JSON.parse(readFileSync(new URL('./summaries-fixture.json', import.meta.url), 'utf8'));

const browser = await puppeteer.launch({executablePath: process.env.CHROME_PATH, headless: true});
const page = await browser.newPage();
if (ai === 'mock') {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.method() === 'POST' && /\/api\/summaries$/.test(new URL(req.url()).pathname)) {
      req.respond({status: 200, contentType: 'application/json',
        headers: {'access-control-allow-origin': origin}, body: JSON.stringify(summaries)});
    } else {
      req.continue();
    }
  });
}
// sessionStorage is per tab; seed it in the tab Lighthouse will drive.
await page.goto(`${origin}/`, {waitUntil: 'networkidle0'});
await page.evaluate((u) => sessionStorage.setItem('user', JSON.stringify(u)), user);

const flow = await startFlow(page, {
  name: `seeded ${formFactor} (ai=${ai})`,
  config: formFactor === 'desktop' ? desktopConfig : undefined,
});
await flow.navigate(`${origin}/summary`, {name: `/summary seeded, ai=${ai}`});
await page.waitForSelector('h3', {timeout: 60_000}); // example summary cards rendered
await flow.navigate(`${origin}/resume`, {name: '/resume seeded (warm: storage not reset)'});
await page.waitForSelector('[contenteditable="true"]', {timeout: 30_000});
await flow.startTimespan({name: '/resume typing in Lexical editor'});
await page.click('[contenteditable="true"]');
await page.keyboard.type('Performance typing sample for INP and TBT. ', {delay: 20});
await flow.endTimespan();

writeFileSync(`${out}/flow-${formFactor}-${ai}.report.html`, await flow.generateReport());
writeFileSync(`${out}/flow-${formFactor}-${ai}.json`, JSON.stringify(await flow.createFlowResult(), null, 2));
await browser.close();
JS
bun install
cd "$PERF_ROOT"
```

Run it (3 repetitions per form factor; the flow report lists every step's metrics):

```bash
for ff in mobile desktop; do
  for i in 1 2 3; do
    CHROME_PATH="$CHROME_PATH" node docs/perf/tools/flow.mjs --origin="$PERF_ORIGIN" --out="$PERF_DIR/lighthouse/flows/run-$i" --formFactor="$ff" --ai=mock
  done
done
# Pull the step metrics out of one flow result (step 0 = /summary navigation, 1 = /resume navigation, 2 = typing timespan):
jq '[.steps[] | {name: .name, mode: .lhr.gatherMode,
     fcp: .lhr.audits["first-contentful-paint"].numericValue, lcp: .lhr.audits["largest-contentful-paint"].numericValue,
     tbt: .lhr.audits["total-blocking-time"].numericValue, cls: .lhr.audits["cumulative-layout-shift"].numericValue,
     inp: .lhr.audits["interaction-to-next-paint"].numericValue}]' "$PERF_DIR/lighthouse/flows/run-1/flow-mobile-mock.json"
```

If the mocked flow hangs at `waitForSelector('h3')` (see Open questions on
interception), rerun with `--ai=live` once to confirm the page works, then use the
fallback for Tier 1 instead: add `--settings.blockedUrlPatterns='*/api/summaries'` to
the `/summary` collect in step 2.

### 5. API latency for `/api/summaries` with the model stubbed

Stub (Bun) - answers the OpenAI Responses API shape the AI SDK parses:

```bash
cat > docs/perf/tools/openai-stub.ts <<'TS'
// Minimal OpenAI Responses API stub for perf runs. POST <anything>/responses -> fixed completion.
const summaries = await Bun.file(new URL('./summaries-fixture.json', import.meta.url)).json();
const body = {
  id: 'resp_perf', object: 'response', created_at: 0, model: 'perf-stub', status: 'completed',
  output: [{ type: 'message', role: 'assistant', id: 'msg_perf', status: 'completed',
    content: [{ type: 'output_text', text: JSON.stringify({ summaries }), annotations: [] }] }],
  usage: { input_tokens: 1, output_tokens: 1 },
};
const port = Number(process.env.PORT ?? 8788);
Bun.serve({ port, fetch(req) {
  const url = new URL(req.url);
  if (req.method === 'POST' && url.pathname.endsWith('/responses')) return Response.json(body);
  return new Response('not found', { status: 404 });
}});
console.log(`openai stub listening on http://127.0.0.1:${port}`);
TS
```

Local Worker (framework overhead). Needs a `perf` environment in
`packages/backend/wrangler.jsonc` (vars are non-inheritable, so repeat
`ALLOWED_COUNTRIES`) and a `.dev.vars.perf`. `packages/backend/.gitignore` ignores only
`.dev.vars` exactly, so add `.dev.vars.*` to it first.

```bash
# One-time edits:
#   packages/backend/wrangler.jsonc  ->  "env": { "perf": { "vars": { "ALLOWED_COUNTRIES": "US" } } }
#   packages/backend/.gitignore      ->  add a line:  .dev.vars.*
cat > packages/backend/.dev.vars.perf <<'ENV'
ALLOWED_ORIGIN=http://localhost:5173
ALLOWED_COUNTRIES=US
OPENAI_API_KEY=perf-stub
OPENAI_BASE_URL=http://127.0.0.1:8788/v1
ENV
PORT=8788 bun docs/perf/tools/openai-stub.ts &
STUB_PID=$!
(cd packages/backend && bunx wrangler dev --local --env perf --port 8787) &
WRANGLER_PID=$!
sleep 8
# Sanity: expect 200 and the fixture summaries. A 403 means request.cf.country was not populated locally (see Open questions).
curl -s -X POST http://127.0.0.1:8787/api/summaries -H 'content-type: application/json' --data @docs/perf/tools/summaries-request.json; echo

API=http://127.0.0.1:8787
for i in $(seq 1 30); do
  curl -s -o /dev/null -X POST "$API/api/summaries" -H 'content-type: application/json' \
    --data @docs/perf/tools/summaries-request.json \
    -w "{\"i\":$i,\"code\":%{response_code},\"namelookup\":%{time_namelookup},\"connect\":%{time_connect},\"appconnect\":%{time_appconnect},\"starttransfer\":%{time_starttransfer},\"total\":%{time_total},\"bytes\":%{size_download},\"ray\":\"%header{cf-ray}\"}\n"
done > "$PERF_DIR/api/summaries-local-stub.jsonl"
kill $WRANGLER_PID $STUB_PID
jq -s '{samples:length, first:(.[0].starttransfer),
        starttransfer:{min:(map(.starttransfer)|min), p50:(map(.starttransfer)|sort|.[length/2|floor]), p95:(map(.starttransfer)|sort|.[(length*0.95|floor)]), max:(map(.starttransfer)|max)},
        total:{p50:(map(.total)|sort|.[length/2|floor]), p95:(map(.total)|sort|.[(length*0.95|floor)])},
        nonOk:(map(select(.code!=200))|length)}' "$PERF_DIR/api/summaries-local-stub.jsonl"
```

Edge Worker (cold/warm; optional but recommended once per tag). The stub must be
reachable from Cloudflare, so deploy it as its own free Worker, then deploy the backend
`perf` environment pointing at it:

```bash
mkdir -p docs/perf/tools/openai-stub-worker/src
cat > docs/perf/tools/openai-stub-worker/wrangler.jsonc <<'JSONC'
{ "name": "scc-openai-stub", "main": "src/index.ts", "compatibility_date": "2025-02-26" }
JSONC
cat > docs/perf/tools/openai-stub-worker/src/index.ts <<'TS'
import summaries from '../../summaries-fixture.json';
const body = {
  id: 'resp_perf', object: 'response', created_at: 0, model: 'perf-stub', status: 'completed',
  output: [{ type: 'message', role: 'assistant', id: 'msg_perf', status: 'completed',
    content: [{ type: 'output_text', text: JSON.stringify({ summaries }), annotations: [] }] }],
  usage: { input_tokens: 1, output_tokens: 1 },
};
export default { fetch(req: Request) {
  const url = new URL(req.url);
  if (req.method === 'POST' && url.pathname.endsWith('/responses')) return Response.json(body);
  return new Response('not found', { status: 404 });
}};
TS
(cd docs/perf/tools/openai-stub-worker && bunx wrangler deploy)     # prints https://scc-openai-stub.<subdomain>.workers.dev
# Add to packages/backend/wrangler.jsonc env.perf.vars:  "OPENAI_BASE_URL": "https://scc-openai-stub.<subdomain>.workers.dev/v1"
(cd packages/backend && printf 'perf-stub' | bunx wrangler secret put OPENAI_API_KEY --env perf \
  && printf 'https://sccc.netlify.app' | bunx wrangler secret put ALLOWED_ORIGIN --env perf \
  && bunx wrangler deploy --env perf)                                # prints https://scc-backend-perf.<subdomain>.workers.dev
API=https://scc-backend-perf.<subdomain>.workers.dev                # sample 1 = cold (first request after deploy)
for i in $(seq 1 30); do
  curl -s -o /dev/null -X POST "$API/api/summaries" -H 'content-type: application/json' \
    --data @docs/perf/tools/summaries-request.json \
    -w "{\"i\":$i,\"code\":%{response_code},\"namelookup\":%{time_namelookup},\"connect\":%{time_connect},\"appconnect\":%{time_appconnect},\"starttransfer\":%{time_starttransfer},\"total\":%{time_total},\"bytes\":%{size_download},\"ray\":\"%header{cf-ray}\"}\n"
done > "$PERF_DIR/api/summaries-edge-stub.jsonl"
jq -s '{cold_starttransfer:.[0].starttransfer, warm_p50:(.[1:]|map(.starttransfer)|sort|.[length/2|floor]), warm_p95:(.[1:]|map(.starttransfer)|sort|.[(length*0.95|floor)]), colos:(map(.ray|split("-")[1])|unique)}' "$PERF_DIR/api/summaries-edge-stub.jsonl"
# Tear down when done so the perf Worker does not linger:
(cd packages/backend && bunx wrangler delete --env perf)
(cd docs/perf/tools/openai-stub-worker && bunx wrangler delete)
```

Live model, documentation only (5 samples against the production backend URL used by
the deployed frontend; costs tokens):

```bash
API=<production backend origin from VITE_HONO_BACKEND_URL>
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -X POST "$API/api/summaries" -H 'content-type: application/json' \
    --data @docs/perf/tools/summaries-request.json \
    -w "{\"i\":$i,\"code\":%{response_code},\"starttransfer\":%{time_starttransfer},\"total\":%{time_total},\"ray\":\"%header{cf-ray}\"}\n"
done > "$PERF_DIR/api/summaries-live.jsonl"
```

### 6. Field-data probes (free)

```bash
# CrUX: expect an error/empty result for this origin; record the response either way.
curl -s "https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=$CRUX_API_KEY" \
  -H 'content-type: application/json' --data "{\"origin\":\"$PERF_ORIGIN\",\"formFactor\":\"PHONE\"}" \
  > "$PERF_DIR/api/crux-origin.json"; jq -c '.error.message // (.record.metrics|keys)' "$PERF_DIR/api/crux-origin.json"
```

Cloudflare Web Analytics has no CLI: in the dashboard add `sccc.netlify.app` as a
non-proxied site, paste the snippet before `</body>` in the frontend's root document, and
note the date it went live in `meta.json` so field data can be read from that date on.

### 7. Finish

```bash
docs/perf/tools/extract-summary.sh "$PERF_DIR"
jq --slurpfile b "$PERF_DIR/bundle/sizes.json" --slurpfile l "$PERF_DIR/api/summaries-local-stub.jsonl" \
   '. + {bundle: $b[0].totals, apiLocalStubStarttransferP50: ($l | map(.starttransfer) | sort | .[length/2|floor])}' \
   "$PERF_DIR/summary.json" > "$PERF_DIR/summary.tmp" && mv "$PERF_DIR/summary.tmp" "$PERF_DIR/summary.json"
git add docs/perf && git status --short docs/perf
# Diff against the baseline once an "after" tag exists:
# diff <(jq -S . docs/perf/baseline/pre-remix-v3/summary.json) <(jq -S . docs/perf/<after-tag>/summary.json)
```

## Open questions / unverified

1. **Puppeteer request interception inside a Lighthouse user flow.** Lighthouse and
   Puppeteer share the page's CDP connection; whether `setRequestInterception(true)`
   coexists with Lighthouse's navigation gatherers in 13.5.0 was not tested here (no
   Chrome on this machine, and no production measurements were allowed in this ticket).
   The verified fallback is `--blocked-url-patterns` / `settings.blockedUrlPatterns`.
2. **`request.cf.country` under `wrangler dev --local`.** The geo middleware returns 403
   when `cf.country` is missing. Cloudflare's docs read here do not state whether local
   mode populates `request.cf`; the Runbook's sanity `curl` detects it. If it is 403, the
   only code-free option is `wrangler dev --remote` (runs on Cloudflare's network, so it
   also stops being a pure local-overhead number).
3. **Forcing a Worker cold start.** Cloudflare documents that isolates are short-lived
   and start quickly, but not how to force eviction; "first request after deploy" is a
   proxy, not a guarantee, and a request landing at a different colo (`cf-ray` suffix) is
   a different isolate.
4. **WebPageTest free-tier API access.** `docs.webpagetest.org` served a certificate
   for `*.netlify.app` on 2026-10-12 and could not be read; only the Catchpoint mirror of
   the legacy API doc was available, and it does not say whether the free plan includes
   API keys.
5. **Cloudflare Web Analytics retention / sampling** and **Netlify RUM pricing** are
   not stated on the pages read (Netlify RUM is Pro/Enterprise per its docs; the
   pricing page did not name it).
6. **Where user state lives after the migration.** If Remix v3 moves the builder state
   out of `sessionStorage` (cookies/session on the Worker), the Tier 2 seeding step must
   change (set a cookie instead), and unseeded Tier 1 `/summary` may start rendering
   differently. The metric contract (`summary.json` fields) does not change.
7. **`total-byte-weight` on intercepted responses** - whether a Puppeteer-fulfilled
   response is counted with a realistic `transferSize` was not verified; Tier 1 numbers
   (no interception) are the ones used for byte comparisons anyway.
8. **LHCI `manifest.json` `jsonPath` form** (absolute vs. relative to `outputDir`) was
   not confirmed; `extract-summary.sh` handles both. The script was written against the
   Lighthouse 13.5.0 audit IDs and LHCI manifest fields confirmed above but has not been
   executed, because no reports exist yet.
9. **Build output path after the migration** (`dist/client` today) is a placeholder for
   the Remix v3 build; the "after" run must record the real path in `meta.json`.

## Sources

- Lighthouse readme: https://github.com/GoogleChrome/lighthouse/blob/main/readme.md
- Lighthouse variability: https://github.com/GoogleChrome/lighthouse/blob/main/docs/variability.md
- Lighthouse throttling: https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md
- Lighthouse user flows: https://github.com/GoogleChrome/lighthouse/blob/main/docs/user-flows.md
- Lighthouse result format: https://github.com/GoogleChrome/lighthouse/blob/main/docs/understanding-results.md
- Lighthouse changelog (10.0.0 TTI note): https://github.com/GoogleChrome/lighthouse/blob/main/changelog.md
- Lighthouse 13.5.0 package as installed by bunx (`~/.bun/install/cache/lighthouse@13.5.0`): `cli/cli-flags.js`, `core/config/default-config.js`, `core/config/desktop-config.js`, `core/config/constants.js`, `core/user-flow.js`, `core/gather/driver/storage.js`, `core/audits/**`, `core/index.js`, `package.json`; `@paulirish/trace_engine@0.0.65` `models/trace/lantern/simulation/Constants.js`
- Lighthouse CI configuration: https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md
- Lighthouse CI getting started: https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/getting-started.md
- Lighthouse performance scoring: https://developer.chrome.com/docs/lighthouse/performance/performance-scoring
- Lighthouse TTFB audit: https://developer.chrome.com/docs/lighthouse/performance/time-to-first-byte
- What's new in Lighthouse 10: https://developer.chrome.com/blog/lighthouse-10-0
- web.dev: https://web.dev/articles/vitals, https://web.dev/articles/ttfb, https://web.dev/articles/fcp, https://web.dev/articles/inp, https://web.dev/articles/tbt, https://web.dev/articles/lab-and-field-data-differences
- CrUX: https://developer.chrome.com/docs/crux/api, https://developer.chrome.com/docs/crux/methodology
- PageSpeed Insights API: https://developers.google.com/speed/docs/insights/v5/get-started
- WebPageTest legacy API (Catchpoint mirror): https://docs.catchpoint.com/wpt/docs/webpagetest-legacy-api.md
- Cloudflare Web Analytics: https://developers.cloudflare.com/web-analytics/, https://developers.cloudflare.com/web-analytics/get-started/, https://developers.cloudflare.com/web-analytics/data-metrics/core-web-vitals/, https://developers.cloudflare.com/web-analytics/limits/, https://www.cloudflare.com/web-analytics/
- Cloudflare Workers: https://developers.cloudflare.com/workers/reference/how-workers-works/, https://developers.cloudflare.com/workers/platform/limits/, https://developers.cloudflare.com/workers/observability/metrics-and-analytics/, https://developers.cloudflare.com/workers/wrangler/commands/workers/, https://developers.cloudflare.com/workers/wrangler/environments/, https://developers.cloudflare.com/workers/configuration/environment-variables/, https://developers.cloudflare.com/workers/configuration/previews/, https://developers.cloudflare.com/fundamentals/reference/http-headers/
- Netlify: https://docs.netlify.com/monitor-sites/site-analytics/, https://docs.netlify.com/manage/monitoring/web-analytics/how-web-analytics-works/, https://docs.netlify.com/monitor-sites/real-user-metrics/, https://docs.netlify.com/manage/monitoring/lighthouse/
- React Router: https://reactrouter.com/how-to/spa, https://reactrouter.com/api/framework-conventions/react-router.config.ts
- Puppeteer: https://pptr.dev/browsers-api, https://pptr.dev/api/puppeteer.page.setrequestinterception, https://pptr.dev/api/puppeteer.launchoptions
- Bun: https://bun.sh/docs/cli/bunx
- curl 8.18.0 `man curl` (`--write-out` variables); `%header{}` verified live
- AI SDK: `node_modules/@ai-sdk/openai@3.0.74/dist/index.mjs` (`createResponsesModel`, `openaiResponsesResponseSchema`, default `baseURL`)
- Repo: `packages/frontend/app/routes.ts`, `routes/builder/summary.tsx`, `routes/builder/resume.tsx`, `routes/api/summary.tsx`, `utils/suggestions.ts`, `utils/user.ts`, `utils/schemas/experience.ts`, `lib/environment.ts`, `react-router.config.ts`, `public/_redirects`; `packages/backend/src/index.ts`, `src/services/model.ts`, `src/services/ai.ts`, `src/middleware/geo-restriction.ts`, `lib/environment.ts`, `wrangler.jsonc`, `package.json`, `.gitignore`
