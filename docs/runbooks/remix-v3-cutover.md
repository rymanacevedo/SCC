# Remix v3 cutover runbook

Ordered steps from the last Netlify deploy of the React Router app to the committed
after-report of the Remix v3 app. Written for the driving dev to run alone, in one sitting
for the cutover day itself, with **no decisions left inside it**: every rule below was settled
on the wayfinder map [#174](https://github.com/rymanacevedo/SCC/issues/174), and the ticket
that settled each one is linked where it applies. Decided in
[#195](https://github.com/rymanacevedo/SCC/issues/195); amended in
[#231](https://github.com/rymanacevedo/SCC/issues/231) because the rewrite reached `main`
incrementally (workspace collapse `d528db7` through #230) instead of as one merge on cutover day.

Every step is run by the dev on their own machine or in a dashboard. No step is agent-run:
the repo's Claude hook blocks pushes and agent sessions hold no Cloudflare or Netlify login.

## Terms

- **Cutover**: the moment the Netlify 301 goes live (3.3). Until then every visitor is on
  Netlify + `scc-backend`, whatever `main` or `scc` contain.
- **Cutover commit**: the `main` SHA deployed on `scc` when the 301 goes live, as recorded in
  3.1. Tagged `remix-v3/cutover`.
- **Gated SHA**: the `main` commit whose gate run passed (Phase 2), tagged `remix-v3/gate-<n>`.
- **Gate run**: the full measurement ([#179](https://github.com/rymanacevedo/SCC/issues/179)
  method, [#183](https://github.com/rymanacevedo/SCC/issues/183) rules) taken on a Version URL of
  the `scc` Worker **before** the cutover. Any FAIL blocks the cutover.
- **Report run**: the same measurement taken on production **after** the cutover. It is the
  committed "after"; a FAIL here fixes forward, never rolls back.
- **Rollback window**: from the Netlify 301 (3.3) until `scc-backend` is deleted (3.5).
  Rollback is possible only inside it, and only for a functional failure.
- **Version URL**: the preview produced by `wrangler versions upload`, which runs the uploaded
  code on the Worker's own secrets and bindings. This is *not* a Worker Preview
  (`wrangler preview`), which gets its own empty secrets.

## Dates

Fill in as each milestone passes. These lines are the record.

| milestone | date (UTC) |
| --- | --- |
| `scc` created (1.1) | 2026-10-14 (version `d53e1337`, from `50ad8a4`) |
| Gate run passed (final attempt) | |
| Smoke checks passed (3.2) | |
| Netlify 301 live: cutover, rollback window opens (3.3) | |
| `scc-backend` deleted: rollback window closes (3.5) | |
| Report run committed | |
| Netlify site deleted (cutover + 30 days) | |

---

## Phase 0. Preconditions

Every line must be true before Phase 1 starts. Anything false means stop. Lines checked on
2026-10-14 carry their evidence.

- [x] The package upgrade PRs from [#185](https://github.com/rymanacevedo/SCC/issues/185)
      (Zod 4, AI SDK 7, TypeScript 7, Cloudflare trio, Bun pin, tooling) are merged on `main`.
      Evidence: `3c15545` and the upgrade history before the collapse `d528db7`.
- [x] The rewrite is complete on `main`: single root package
      ([#191](https://github.com/rymanacevedo/SCC/issues/191)), all 12 builder pages, Preview,
      exports, the five API routes, `wrangler.jsonc` with `name: "scc"`,
      `assets.run_worker_first: ["/api/*"]`, `assets.not_found_handling: "single-page-application"`,
      `observability.enabled: true`, vars `ALLOWED_COUNTRIES` and `GITHUB_REPO`.
      Evidence: [#216](https://github.com/rymanacevedo/SCC/issues/216),
      [`issue-216-phase-0.md`](issue-216-phase-0.md).
- [x] On `main`, locally: `bun test` green and `bun run test:e2e` green
      ([#194](https://github.com/rymanacevedo/SCC/issues/194): the Flow test is required before
      the gate). Evidence: run by the dev on `main` at `eed0088`, 2026-10-14.
- [x] The baseline results branch `perf/baseline-pre-remix-v3` is merged to `main`, so
      `docs/perf/baseline/pre-remix-v3/summary.json` exists. Evidence:
      [`issue-216-phase-0.md`](issue-216-phase-0.md).
- [x] `docs/perf/thresholds.json` and the verdict script `docs/perf/tools/verdict.mjs` exist on
      `main` and run against the baseline `summary.json` without error. Evidence: baseline
      self-check `Overall: PASS` in [`issue-216-phase-0.md`](issue-216-phase-0.md).
- [x] `docs/perf/tools/flow.mjs` imports its stub and fixtures from root `e2e/` and seeds the new
      storage envelope ([#192](https://github.com/rymanacevedo/SCC/issues/192)); fixture content is
      byte-identical to the baseline. Evidence: `cmp` result in
      [`issue-216-phase-0.md`](issue-216-phase-0.md).
- [x] [#196](https://github.com/rymanacevedo/SCC/issues/196) is done: Cloudflare Web Analytics
      has been collecting on `sccc.netlify.app` since 2026-10-13.
- [x] A `.node-version` file reading `24` is at the repo root on `main`.
- [x] On the dev machine: `bunx wrangler whoami` shows the account; `netlify status` shows the
      `sccc` site linked; `CHROME_PATH` points at Chrome for Testing 155 (`e2e/browser.json`);
      `node --version` is 24.x; `jq` installed. Evidence: confirmed by the dev, 2026-10-14.
- [x] Netlify builds are stopped (1.5). Evidence: confirmed by the dev, 2026-10-14.
- [x] This runbook, as amended by [#231](https://github.com/rymanacevedo/SCC/issues/231), is
      merged on `main` (#232).

---

## Phase 1. Pre-cutover

Nothing in this phase touches traffic. Production is still Netlify + `scc-backend`; `scc`
receives no visitors until the 301 in 3.3, so deploying `main` to it is safe.

### 1.1 Create the `scc` Worker from `main`

Deploying once from the dev machine creates the Worker so secrets can be set and Workers Builds
has something to attach to. Nobody visits it yet.

```bash
git switch main && git pull
bun install --frozen-lockfile
bun run build                     # vite build; writes dist/<worker>/wrangler.json
bunx wrangler deploy              # picks up the generated config via .wrangler/deploy/config.json
```

Expect the deploy summary to name `scc` and print `https://scc.ryan-avocado-6a07yrtc.workers.dev`.
Record the date.

### 1.2 Set secrets

Vars (`ALLOWED_COUNTRIES`, `GITHUB_REPO`) come from `wrangler.jsonc` and are already live after
1.1. Secrets are set once and survive every later deploy and version upload
([#182](https://github.com/rymanacevedo/SCC/issues/182)).

```bash
bunx wrangler secret put OPENAI_API_KEY --name scc
bunx wrangler secret put GITHUB_TOKEN --name scc
# optional, only if production should override the defaults:
# bunx wrangler secret put OPENAI_BASE_URL --name scc
# bunx wrangler secret put OPENAI_MODEL --name scc
bunx wrangler secret list --name scc
```

Do **not** set `ALLOWED_ORIGIN`, `VITE_HONO_BACKEND_URL`, or `GEMINI_API_KEY`: the first two no
longer exist ([#193](https://github.com/rymanacevedo/SCC/issues/193)), the third is eval-only.

### 1.3 Connect Workers Builds (done 2026-10-14)

Workers Builds runs as two build triggers on `scc`, both on the existing repo connection to
`rymanacevedo/SCC` and the existing build token (shared with `scc-backend`). Created through the
Cloudflare API; in the dashboard they appear under Workers & Pages → `scc` → Settings → Build.

| setting | `Deploy default branch` | `Deploy non-production branches` |
| --- | --- | --- |
| Branch includes | `main` | `*` |
| Branch excludes | *(none)* | `main` |
| Root directory | `/` | `/` |
| Build command | `bun install --frozen-lockfile && bun run build` | same |
| Deploy command | `bunx wrangler deploy` | `bunx wrangler versions upload` |
| Build variables | `BUN_VERSION=1.4.3` | `BUN_VERSION=1.4.3` |
| Path includes / excludes | `*` / *(none)* | `*` / *(none)* |

Notes:

- The `main` trigger deploys `scc` production on every push to `main`. That is harmless: no
  traffic reaches `scc` until 3.3.
- The non-production deploy command **must** be `versions upload`, not `wrangler preview`.
  Only a Version URL runs on the secrets set in 1.2; a Worker Preview starts with none and the
  gate's manual walk would fail on every AI call.
- Deploy commands use `bunx`, matching the rest of the toolchain; wrangler still runs on Node
  through its shebang, never `--bun`.
- Node is pinned by `.node-version`; `BUN_VERSION` is set explicitly because Workers Builds'
  package-manager detection from `packageManager` is undocumented.
- `scc-backend` keeps its own `main` trigger rooted at `/packages/backend`. Since the collapse it
  fails on every push and deploys nothing; it goes away with the Worker in 3.5.

Confirm the first build of each trigger goes green: Workers & Pages → `scc` → Deployments. If
either fails, fix the trigger before Phase 2; the gate needs non-production builds working (or
uses the 1.6 fallback).

### 1.4 Web Analytics for the new hostname (done 2026-10-14)

Done through the Cloudflare API: site tag `9899ff2ec4ac4b7296721a2d49b9ea43`, token in the
`index.html` beacon tag.

Cloudflare dashboard → Analytics & Logs → Web Analytics → Add a site → hostname
`scc.ryan-avocado-6a07yrtc.workers.dev` (JS snippet, not proxied). Put the token into the shell
on `main`: replace `REPLACE_WITH_WORKER_ANALYTICS_TOKEN` in the beacon tag in `index.html`, and
land it by PR. Workers Builds redeploys `scc`.

The beacon is verified on **production** in 3.2, not on the Version URL: the token is bound to
the hostname by suffix match, so a `<alias>-scc.…workers.dev` preview may log a CORS error from
`cloudflareinsights.com`. That error is expected and harmless on the preview.

If the dashboard refuses a `workers.dev` hostname, record "field data: unavailable, hostname
rejected" in the verdict's field-data appendix and continue. Field data is reported, never
scored ([#183](https://github.com/rymanacevedo/SCC/issues/183)).

### 1.5 Freeze Netlify (done 2026-10-14)

Netlify dashboard → `sccc` → Project configuration → Build & deploy → Continuous deployment →
Build settings → **Stop builds**.

This keeps the current React Router deploy published and keeps the Deploys list (needed for
rollback) while guaranteeing that no push to `main`, which no longer contains
`packages/frontend`, can trigger a Netlify build. Do **not** unlink the repository: unlinking
deletes deploy keys and hooks for nothing. Manual CLI deploys (3.3) still work with builds
stopped.

### 1.6 Get a Version URL and verify it

Gate runs measure a Version URL, never `scc` production
([#183](https://github.com/rymanacevedo/SCC/issues/183)). The Version URL comes from a **gate
branch**: a branch named `gate/remix-v3-<n>` pointing at the `main` commit to be measured, with
`<n>` matching the gate attempt in 2.2.

```bash
git switch main && git pull
git switch -c gate/remix-v3-1        # gate/remix-v3-2… for later attempts
git push -u origin gate/remix-v3-1
```

The `Deploy non-production branches` trigger (1.3) builds the push and runs `versions upload`. The Version URL, of the form
`https://<alias>-scc.ryan-avocado-6a07yrtc.workers.dev`, is printed in that build's log
(Workers & Pages → `scc` → Deployments → the build for the gate branch).

Fallback, if preview builds are not producing a Version URL: upload from the gate branch locally.

```bash
bun install --frozen-lockfile && bun run build
bunx wrangler versions upload        # prints "Version Preview URL: https://<id>-scc.…workers.dev"
```

Export it:

```bash
export GATE_ORIGIN="https://<alias>-scc.ryan-avocado-6a07yrtc.workers.dev"
```

Verify the version before measuring it:

```bash
# routing, same-origin guard, validation: 400 with { error, issues }, no side effect (#193)
curl -s -i -X POST "$GATE_ORIGIN/api/errors" -H 'content-type: application/json' --data '{}' | head -20
# SPA fallback on a deep URL
curl -s -o /dev/null -w '%{http_code}\n' "$GATE_ORIGIN/summary"      # 200, HTML shell
# wrong method and unknown API route
curl -s -o /dev/null -w '%{http_code}\n' "$GATE_ORIGIN/api/summaries"  # 405
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$GATE_ORIGIN/api/nope" # 404
```

Then one manual walk in a browser: home → every builder page → `/summary` suggestions arrive
from the live model → Preview → PDF and DOCX downloads start. Open Cloudflare → `scc` → Logs and
confirm the requests from the walk appear (observability live).

Geo restriction is not checked from a deployed URL (the dev is in an allowed country); the
contract tests own it ([#186](https://github.com/rymanacevedo/SCC/issues/186) proved the port).

### Gate attempts

One line per attempt. A withdrawn attempt keeps its number; the next attempt takes the next one.

| attempt | `main` SHA | Version URL | outcome |
| --- | --- | --- | --- |
| `gate-1` | `5907733` | `https://d74d11ad-scc.ryan-avocado-6a07yrtc.workers.dev` | Withdrawn 2026-10-14 before 2.3. 1.6 checks, browser walk, 2.1 and 2.2 passed; the walk showed the UI regressed from the Netlify app (unstyled controls, lost layout, missing error UI). Fixes land on `main` through the `fix/remove-tab-disclosure` integration branch, then `gate-2`. No perf data was collected. |

---

## Phase 2. Gate run

Everything here is on the gate branch from 1.6, against `GATE_ORIGIN`. The rules are
[#183](https://github.com/rymanacevedo/SCC/issues/183); the commands are the
[#179](https://github.com/rymanacevedo/SCC/issues/179) runbook as executed for the baseline
([#180](https://github.com/rymanacevedo/SCC/issues/180)), with the origin swapped.

### 2.1 Flow test first

```bash
bun run test:e2e
```

Green is required before any Lighthouse collection ([#194](https://github.com/rymanacevedo/SCC/issues/194)).

### 2.2 Tag the attempt

The perf tooling refuses an untagged HEAD. Gate attempts are numbered to match the gate branch;
never reuse a number. The tag goes on the gate branch head, which is a `main` commit.

```bash
git tag remix-v3/gate-1            # gate-2, gate-3… for re-measurements after a fix
git push origin remix-v3/gate-1
export PERF_TAG="$(git describe --tags --exact-match HEAD)"
export PERF_DIR="docs/perf/remix-v3/${PERF_TAG#remix-v3/}"
export PERF_ORIGIN="$GATE_ORIGIN"
```

### 2.3 Collect

Run the #179 runbook steps 1 to 4 (meta, Tier 1 navigations with 5 runs per URL, bundle sizes
from `dist/client`, Tier 2 seeded flows with the AI POST intercepted in Puppeteer). The model
is never called by a timed request: Tier 2 intercepts in the browser, and the API cell below is
local. No stub Worker is deployed and `OPENAI_BASE_URL` is not set on `scc`.

API cell (stubbed p50), local, as in the baseline:

```bash
cat > .dev.vars <<'ENV'
ALLOWED_COUNTRIES=US
OPENAI_API_KEY=perf-stub
OPENAI_BASE_URL=http://127.0.0.1:8788/v1
GITHUB_REPO=rymanacevedo/SCC
GITHUB_TOKEN=perf-stub
ENV
PORT=8788 bun e2e/openai-stub.ts &             # stub lives in e2e/ now (#194)
bun run build && bun run preview &             # Worker in workerd on http://localhost:5173
# 30-sample curl loop from #179 step 5 against http://localhost:5173/api/summaries
```

`localhost`, not `127.0.0.1`: the dev server binds `[::1]` only
([#186](https://github.com/rymanacevedo/SCC/issues/186) finding 4).

Toolchain versions in `meta.json` must match the baseline exactly (Lighthouse 13.5.0, LHCI
0.15.1, Chrome for Testing 155, simulated throttling, 5 runs, 3 flow runs). Drift invalidates
the run.

### 2.4 Verdict

```bash
node docs/perf/tools/verdict.mjs \
  --before docs/perf/baseline/pre-remix-v3/summary.json \
  --after  "$PERF_DIR/summary.json" \
  --thresholds docs/perf/thresholds.json \
  --out docs/perf/verdict-remix-v3.md
tail -1 docs/perf/verdict-remix-v3.md       # one overall PASS / FAIL line
```

Commit the attempt to `main` by PR, whatever the outcome (the uncommitted results carry over
the branch switch):

```bash
git switch -c "perf/remix-v3-${PERF_TAG#remix-v3/}" main
git add "$PERF_DIR" docs/perf/verdict-remix-v3.md
git commit -m "perf(remix-v3): record ${PERF_TAG#remix-v3/} gate run and verdict"
```

Push the branch and open a PR against `main` (`gh pr create --fill`); merge it. The PR touches
only `docs/`, so it does not invalidate the gated SHA (see 3.1).

Outcomes, exactly as [#183](https://github.com/rymanacevedo/SCC/issues/183) rules:

- **PASS**: the gate branch head is the **gated SHA**. Record the date in the Dates table.
  Proceed to Phase 3.
- **Narrow timing miss** (FCP, LCP, TBT, or INP failing by less than twice its tolerance):
  re-collect that cell once with `--numberOfRuns=9`; those medians are final. Byte and CLS
  cells get no re-run.
- **FAIL**: fix on `main` by PR, then return to 1.6 with the next gate branch
  (`gate/remix-v3-<n+1>`) and 2.1 with the next `gate-<n>` tag. The failed attempt's directory
  stays committed. Thresholds are never edited here; changing one needs a new ticket on the map.

Delete gate branches once their attempt is committed; the `remix-v3/gate-<n>` tags are the
record.

---

## Phase 3. Cutover day

Run top to bottom without pausing between 3.3 and 3.5. Re-check Phase 0 first.

### 3.1 Confirm `scc` production runs the gated code

Workers Builds has been deploying `main` to `scc` since 1.3. Check what production runs:
Workers & Pages → `scc` → Deployments shows the commit SHA of the active deployment. From the
machine:

```bash
git switch main && git pull
bunx wrangler deployments list --name scc | head -20
export GATED_SHA="$(git rev-list -n1 remix-v3/gate-<n>)"     # the passing attempt
export CUTOVER_SHA="<SHA of the active deployment>"
git diff --name-only "$GATED_SHA" "$CUTOVER_SHA" -- . ':!docs'
```

- **Empty diff**: production runs the gated code (docs-only commits since are fine). Record
  `CUTOVER_SHA` here; it is the cutover commit.
- **Non-empty diff**: app or worker code changed after the gate. Re-gate (1.6 with the next
  `<n>`) before continuing. Freeze `main` until cutover is done to avoid this.
- **Active deployment is not `main`'s latest** (a Workers Build failed): use the break-glass
  path, which produces the same artifact, then repeat 3.1:

  ```bash
  bun install --frozen-lockfile && bun run build && bunx wrangler deploy
  ```

### 3.2 Production smoke (six checks)

Run against `scc` production **before** the 301, while it still has no visitors: a failure here
costs nothing. `PROD=https://scc.ryan-avocado-6a07yrtc.workers.dev`. Each check proves one
route, secret, or binding. All six must pass.

1. **Routing, guard, validation.**
   `curl -s -i -X POST "$PROD/api/errors" -H 'content-type: application/json' --data '{}'`
   → `400` with the `{ error, issues }` envelope.
2. **SPA fallback.** Hard reload on `$PROD/summary` in a browser serves the shell, no 404.
3. **Live model.** On `/summary`, suggestions arrive (proves `OPENAI_API_KEY`, the generation
   seam, and `ALLOWED_COUNTRIES`).
4. **Builder-page form pattern.** On `/summary`: an invalid submit re-renders in place with the
   typed text kept; a valid submit lands on `/finish-up`; Back returns to `/summary` with the
   value preloaded.
5. **Whole journey.** Home → all 12 builder pages → Preview at `/resume` → PDF download starts
   → DOCX download starts.
6. **GitHub reporting.** Submit a report-issue from the UI; the issue appears on
   `rymanacevedo/SCC` (proves `GITHUB_TOKEN` and `GITHUB_REPO`); close it with a comment
   "cutover smoke".

Also confirm, without it being a gate: the Web Analytics beacon request to
`cloudflareinsights.com/cdn-cgi/rum` returns 2xx in the browser's network panel, and the smoke
requests show in `scc` → Logs.

**A failure here is not a rollback**: nobody has been moved. Fix forward on `main`, then return
to 3.1 (which re-gates if the fix touched code). Record the date once all six pass.

### 3.3 Redirect Netlify → cutover, rollback window opens

Builds are stopped (1.5), so this is a manual production deploy of a two-file directory.
`301!` forces the redirect even though the shell files no longer exist at those paths; the
`index.html` exists only so the deploy is never empty.

```bash
dir="$(mktemp -d)"
printf '/* https://scc.ryan-avocado-6a07yrtc.workers.dev/:splat 301!\n' > "$dir/_redirects"
printf '<!doctype html><title>SCC has moved</title><a href="https://scc.ryan-avocado-6a07yrtc.workers.dev/">SCC has moved</a>\n' > "$dir/index.html"
netlify deploy --prod --no-build --dir="$dir"
```

Verify:

```bash
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://sccc.netlify.app/
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://sccc.netlify.app/summary
```

Both `301` to the Worker URL with the path preserved. This is the cutover: record the date.
From here until 3.5, a functional failure is handled by the [Rollback](#rollback) section.

Old-origin `sessionStorage` is not carried over, by design
([#182](https://github.com/rymanacevedo/SCC/issues/182),
[#192](https://github.com/rymanacevedo/SCC/issues/192)); a user mid-session on the old origin
lands on the new home page.

### 3.4 Re-check through the redirect

Open `https://sccc.netlify.app/summary` in a fresh browser tab: it must land on the Worker's
`/` (empty User redirects home) and suggestions must still work after filling a job. This is the
last check inside the rollback window.

### 3.5 Delete `scc-backend` → rollback window closes

```bash
bunx wrangler delete --name scc-backend      # answer the confirmation prompt if one appears
bunx wrangler deployments list --name scc-backend   # expect "not found"
```

Its secrets go with it. Record the date: **from here there is no rollback**. The 30-day Netlify
redirect is a courtesy for stale links, not a fallback.

### 3.6 Tag the cutover commit

```bash
git tag remix-v3/cutover "$CUTOVER_SHA"      # recorded in 3.1
```

Push the tag to `origin`.

### 3.7 Close the issues the migration resolved

- [#149](https://github.com/rymanacevedo/SCC/issues/149): comment linking #192 as the
  persistence-model record; the new-tab expectation is rejected by design; close.
- [#150](https://github.com/rymanacevedo/SCC/issues/150): fixed by construction; regression
  test from #194; close.
- [#173](https://github.com/rymanacevedo/SCC/issues/173): React Router internals, gone with
  React Router; close.
- [#171](https://github.com/rymanacevedo/SCC/issues/171): experience-entry textarea keyed by its
  text, replaced by a stable per-row id (#184); close.

---

## Phase 4. Report run

At `remix-v3/cutover`, against production. Same method, same toolchain, same fixtures as the
gate.

```bash
git switch main && git checkout -q remix-v3/cutover
export PERF_TAG="$(git describe --tags --exact-match HEAD)"      # remix-v3/cutover
export PERF_DIR="docs/perf/remix-v3/cutover"
export PERF_ORIGIN="https://scc.ryan-avocado-6a07yrtc.workers.dev"
```

Run Phase 2.3 and 2.4's verdict command unchanged (the API cell is local again). Add to
`meta.json`: `"webAnalyticsSince"` for the new hostname and `"gateRun"` naming the passing gate
directory. Then:

```bash
git switch -c perf/remix-v3-cutover main
git add docs/perf/remix-v3/cutover docs/perf/verdict-remix-v3.md
git commit -m "perf(remix-v3): record cutover report run and verdict"
```

Push the branch and open a PR against `main` (`gh pr create --fill`).

Outcomes:

- **PASS**: merge the PR. Record the date. The migration's destination is reached.
- **A cell FAILs that the gate passed**: still merge the PR with the FAIL recorded (the entry
  is never rewritten), open a bug for that cell, fix forward on `main`, and append a dated
  production re-run under `docs/perf/remix-v3/cutover-rerun-<n>/` with a new verdict section.
  No rollback ([#183](https://github.com/rymanacevedo/SCC/issues/183)).

The field-data appendix of the verdict is filled from Cloudflare Web Analytics once the new
hostname has 7 days of traffic; append it in a follow-up commit on `main`.

---

## Phase 5. Cutover + 30 days

1. Netlify dashboard → `sccc` → Project configuration → General → **Delete project**.
2. Cloudflare → Web Analytics → remove the `sccc.netlify.app` site entry.
3. Record the date in the Dates table and commit this file.

Nothing else remains on the old path: `scc-backend` went in 3.5, the proxy routes and
`VITE_HONO_BACKEND_URL` went with the rewrite.

---

## Rollback

**Trigger**: the re-check through the redirect (3.4) fails, or a functional failure on
production is found between 3.3 and 3.5. Performance never triggers a rollback: a gate FAIL
stops you before 3.3, and a report FAIL fixes forward. A smoke failure in 3.2 is not a rollback
either: nobody has been moved yet.

**Window**: open at 3.3 (Netlify 301), closed at 3.5 (`scc-backend` deleted). Inside it, the
frozen Netlify deploy and `scc-backend` both still exist, so the old site can be re-published
intact.

**Steps**, in order:

1. Netlify dashboard → Deploys → the last deploy *before* the redirect (the frozen React Router
   build) → **Publish deploy**. Instant. With builds stopped, nothing can overwrite it.
2. Verify `curl -s -o /dev/null -w '%{http_code}\n' https://sccc.netlify.app/summary` → `200`
   and that the old site's `/summary` still gets suggestions from `scc-backend`.
3. Fix forward on `main` by PR; each merge redeploys `scc` through Workers Builds (nobody is on
   it again). There is no merge to revert: `main` has carried the rewrite since before Phase 1.
4. Resume at 3.1 (which re-gates if the fix touched code). 3.5 never ran, so `scc-backend` is
   still there and rollback stays available on the next attempt.

Netlify's free tier keeps only the published deploy and the most recent successful production
deploy beyond 30 days, which is why the window is same-day: do not plan on re-publishing the old
site weeks later.

---

## Facts not confirmed by documentation

Checked against the Cloudflare and Netlify docs on 2026-10-13; these were not stated and are
handled defensively above. Confirm each the first time you hit it and strike it here.

- Whether Workers Builds picks Bun from `packageManager` (1.3 sets `BUN_VERSION`). With it set,
  builds report `bun@1.4.3, nodejs@24.21.0` detected from the environment (2026-10-14).
- ~~Whether the non-production trigger's `*` branch include matches branch names containing a
  slash~~: it does. `docs/runbook-on-main` built on 2026-10-14 with the alias
  `https://docs-runbook-on-main-scc.ryan-avocado-6a07yrtc.workers.dev` (slashes become dashes).
- Whether `wrangler deployments list` names the commit SHA of a Workers Builds deployment
  (3.1 reads it from the dashboard if not).
- Whether `wrangler delete` prompts for confirmation (3.5 runs it in a terminal).
- ~~Whether Web Analytics accepts a `workers.dev` hostname~~: it does (site created 2026-10-14).
- Whether a Netlify deploy with no `index.html` is accepted (3.3 ships one).
- ~~Netlify's behaviour when the configured base directory is missing on the production
  branch~~: moot, builds were stopped before it could apply (1.5, 2026-10-14).
