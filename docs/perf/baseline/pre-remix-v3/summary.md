# Baseline performance: `baseline/pre-remix-v3`

"Before" numbers for the Remix v3 migration (map #174, ticket #180), taken with the method from
`docs/research/site-speed-measurement-method.md` (#179). Machine, versions, and what ran are in
`meta.json`; machine-readable medians are in `summary.json`; raw Lighthouse results are in
`lighthouse/`, API samples in `api/`, bundle sizes in `bundle/`.

- **Tag commit:** `942d5bd` (frontend and shared trees identical to the commit the bundle was built from; see `meta.json#buildNote`).
- **Measured:** 2026-10-13, production site https://sccc.netlify.app (Netlify static SPA) and the production Worker
  `https://scc-backend.ryan-avocado-6a07yrtc.workers.dev` (URL read from the public bundle).
- **Tooling:** Lighthouse 13.5.0 via LHCI 0.15.1, Chrome for Testing 155, simulated throttling (mobileSlow4G / desktopDense4G),
  5 runs per URL, medians reported.

## Tier 1: cold navigations, no app state (median of 5)

All four paths resolve to the same `index.html` on Netlify, so they measure the SPA shell. `/resume` is the outlier
because it pulls the resume editor and export bundle (~412 kB of script transferred vs ~140 kB elsewhere).

| form factor | page | perf | TTFB ms | FCP ms | LCP ms | TBT ms | CLS | SI ms | bytes total | bytes script |
|---|---|---|---|---|---|---|---|---|---|---|
| mobile | home | 0.90 | 120 | 2863 | 2882 | 0 | 0 | 3044 | 223030 | 140090 |
| mobile | experience | 0.94 | 120 | 1789 | 2995 | 0 | 0 | 1862 | 225048 | 142089 |
| mobile | summary | 0.94 | 99 | 1781 | 2868 | 0 | 0 | 1781 | 222243 | 139435 |
| mobile | resume | 0.84 | 101 | 1760 | 4364 | 0 | 0.003 | 2430 | 495221 | 412297 |
| desktop | home | 0.99 | 101 | 678 | 987 | 0 | 0 | 696 | 222970 | 140093 |
| desktop | experience | 0.99 | 105 | 670 | 982 | 0 | 0 | 706 | 224853 | 141921 |
| desktop | summary | 0.99 | 99 | 650 | 958 | 0 | 0 | 650 | 222281 | 139407 |
| desktop | resume | 0.98 | 96 | 632 | 1069 | 0 | 0.001 | 693 | 495117 | 412240 |

Full table with TTI and document bytes: `tier1.md` (regenerate with `docs/perf/tools/extract-summary.sh <this dir>`).

## Tier 2: seeded user flow (median of 3, AI mocked)

`docs/perf/tools/flow.mjs` seeds `sessionStorage` with `user-fixture.json`, navigates to `/summary` (the POST to
`/api/summaries` is answered by Puppeteer request interception with `summaries-fixture.json`; the CORS preflight still
reaches the live Worker), then to `/resume`, then records a typing timespan in the Lexical editor.

| form factor | step | perf | FCP ms | LCP ms | TBT ms | CLS | INP ms |
|---|---|---|---|---|---|---|---|
| mobile | `/summary` seeded | 0.79 | 1630 | 3156 | 0 | 0.245 | - |
| mobile | `/resume` seeded (warm) | 0.93 | 805 | 2181 | 56 | 0.148 | - |
| mobile | `/resume` typing (timespan) | 1.00 | - | - | 0 | 0.013 | 21 |
| desktop | `/summary` seeded | 0.99 | 574 | 836 | 0 | 0 | - |
| desktop | `/resume` seeded (warm) | 1.00 | 253 | 490 | 0 | 0.044 | - |
| desktop | `/resume` typing (timespan) | 1.00 | - | - | 0 | 0 | 27 |

Noteworthy: the seeded mobile `/summary` has CLS 0.245 (over the 0.1 "poor" threshold) and the seeded mobile `/resume`
0.148; the unseeded Tier 1 pages have none. The shift happens when the summary cards and the editor render after the shell.

## API: `POST /api/summaries`

| measurement | samples | p50 | p95 / max | notes |
|---|---|---|---|---|
| Worker overhead, `wrangler dev --local`, model stubbed | 30 | 3 ms | 4 ms / 4 ms | time to first byte; all 200; `request.cf.country` was populated locally, so the geo middleware passed without changes |
| Production Worker, live model | 5 | 5510 ms | - / 8481 ms | time to first byte; all 200; colo MCI; first sample 8.5 s includes DNS + TLS (0.5 s) and possibly a cold isolate |

The live number is dominated by the model call; the framework overhead is in the single-digit milliseconds.

## Bundle (`bun run build` of `packages/frontend`, `dist/client`)

| asset type | files | bytes | gzip bytes |
|---|---|---|---|
| JS | 71 | 1,801,481 | 543,286 |
| CSS | 1 | 26,231 | 5,751 |

Largest chunks: `resume-main` 928 kB (282 kB gzip; Lexical + docx + jspdf), `html2canvas` 200 kB, `entry.client` 182 kB,
`index.es` 151 kB, `jsx-runtime` 96 kB. Full list in `bundle/sizes.json`; build output in `bundle/build.log`.

## Not measured, and why

- **Edge Worker with stubbed model (cold/warm):** needs the stub deployed as its own Worker plus a `perf` environment
  of the backend on the Cloudflare account. Not done from this session; runbook step 5 has the commands.
- **CrUX field data:** no `CRUX_API_KEY` on this machine. The origin is unlikely to have CrUX data anyway.
- **Cloudflare Web Analytics:** not enabled on the Netlify site; recommended in #179 so the "after" run has field data.

## Reproducing

Runbook: `docs/research/site-speed-measurement-method.md` (branch `research/site-speed-measurement-method`), with these
deviations: HTML reports were deleted after collection (regenerable from the `.report.json`), manifest paths were made
relative, the local Worker ran on the default environment with a temporary gitignored `.dev.vars` instead of a committed
`perf` env, and `extract-summary.sh` writes its table to `tier1.md`. `extract-flows.sh` summarises the flow runs.
