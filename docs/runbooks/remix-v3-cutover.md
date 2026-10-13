# Remix v3 cutover runbook

Ordered steps from the last Netlify deploy of the React Router app to the committed
after-report of the Remix v3 app. Written for the driving dev to run alone, in one sitting
for the cutover day itself, with **no decisions left inside it**: every rule below was settled
on the wayfinder map [#174](https://github.com/rymanacevedo/SCC/issues/174), and the ticket
that settled each one is linked where it applies. Decided in
[#195](https://github.com/rymanacevedo/SCC/issues/195).

Every step is run by the dev on their own machine or in a dashboard. No step is agent-run:
the repo's Claude hook blocks pushes and agent sessions hold no Cloudflare or Netlify login.

## Terms

- **Cutover commit**: the merge commit of the rewrite branch on `main`. Tagged `remix-v3/cutover`.
- **Gate run**: the full measurement ([#179](https://github.com/rymanacevedo/SCC/issues/179)
  method, [#183](https://github.com/rymanacevedo/SCC/issues/183) rules) taken on a Version URL of
  the `scc` Worker **before** the merge. Any FAIL blocks the cutover.
- **Report run**: the same measurement taken on production **after** the cutover. It is the
  committed "after"; a FAIL here fixes forward, never rolls back.
- **Rollback window**: from the merge of the rewrite branch until `scc-backend` is deleted.
  Rollback is possible only inside it, and only for a functional smoke failure.
- **Version URL**: the preview produced by `wrangler versions upload`, which runs the uploaded
  code on the Worker's own secrets and bindings. This is *not* a Worker Preview
  (`wrangler preview`), which gets its own empty secrets.

## Dates

Fill in as each milestone passes. These lines are the record.

| milestone | date (UTC) |
| --- | --- |
| Gate run passed (final attempt) | |
| Cutover commit merged | |
| Smoke checks passed | |
| Netlify 301 live | |
| `scc-backend` deleted (rollback window closed) | |
| Report run committed | |
| Netlify site deleted (cutover + 30 days) | |

---

## Phase 0. Preconditions

Every line must be true before Phase 1 starts. Anything false means stop.

- [ ] The package upgrade PRs from [#185](https://github.com/rymanacevedo/SCC/issues/185)
      (Zod 4, AI SDK 7, TypeScript 7, Cloudflare trio, Bun pin, tooling) are merged on `main`.
- [ ] The rewrite branch is complete: single root package
      ([#191](https://github.com/rymanacevedo/SCC/issues/191)), all 12 builder pages, Preview,
      exports, the five API routes, `wrangler.jsonc` with `name: "scc"`,
      `assets.run_worker_first: ["/api/*"]`, `assets.not_found_handling: "single-page-application"`,
      `observability.enabled: true`, vars `ALLOWED_COUNTRIES` and `GITHUB_REPO`.
- [ ] On the rewrite branch, locally: `bun test` green and `bun run test:e2e` green
      ([#194](https://github.com/rymanacevedo/SCC/issues/194): the Flow test is required before
      merge).
- [ ] The baseline results branch `perf/baseline-pre-remix-v3` is merged to `main`, so
      `docs/perf/baseline/pre-remix-v3/summary.json` exists on the rewrite branch.
- [ ] `docs/perf/thresholds.json` and the verdict script `docs/perf/tools/verdict.mjs` exist on
      the rewrite branch and run against the baseline `summary.json` without error.
- [ ] `docs/perf/tools/flow.mjs` imports its stub and fixtures from root `e2e/` and seeds the new
      storage envelope ([#192](https://github.com/rymanacevedo/SCC/issues/192)); fixture content is
      byte-identical to the baseline.
- [ ] [#196](https://github.com/rymanacevedo/SCC/issues/196) is done: Cloudflare Web Analytics
      has been collecting on `sccc.netlify.app`.
- [ ] A `.node-version` file reading `24` is at the repo root on the rewrite branch.
- [ ] On the dev machine: `bunx wrangler whoami` shows the account; `netlify status` shows the
      `sccc` site linked; `CHROME_PATH` points at Chrome for Testing 155 (`e2e/browser.json`);
      `node --version` is 24.x; `jq` installed.
- [ ] This runbook is merged on `main`.

---

## Phase 1. Pre-cutover

Nothing in this phase touches traffic. Production is still Netlify + `scc-backend`.

### 1.1 Create the `scc` Worker from the rewrite branch

Deploying once from the dev machine creates the Worker so secrets can be set and Workers Builds
has something to attach to. Nobody visits it yet.

```bash
git switch <rewrite-branch>
bun install --frozen-lockfile
bun run build                     # vite build; writes dist/<worker>/wrangler.json
bunx wrangler deploy              # picks up the generated config via .wrangler/deploy/config.json
```

Expect the deploy summary to name `scc` and print `https://scc.ryan-avocado-6a07yrtc.workers.dev`.

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

### 1.3 Connect Workers Builds

Cloudflare dashboard → Workers & Pages → `scc` → Settings → Build → connect the GitHub repo
`rymanacevedo/SCC`.

| setting | value |
| --- | --- |
| Production branch | `main` |
| Root directory | *(empty: the repo root)* |
| Build command | `bun install --frozen-lockfile && bun run build` |
| Deploy command | `npx wrangler deploy` |
| Enable Preview Builds | **on** |
| Preview command | `npx wrangler versions upload` |
| Build variables | `BUN_VERSION=1.4.3` |

Notes:

- The preview command **must** be `npx wrangler versions upload`, not the default
  `npx wrangler preview`. Only a Version URL runs on the secrets set in 1.2; a Worker Preview
  starts with none and the gate's manual walk would fail on every AI call.
- Node is pinned by `.node-version`; `BUN_VERSION` is set explicitly because Workers Builds'
  package-manager detection from `packageManager` is undocumented.
- Until the merge, every push to `main` builds the old two-package layout and **fails**. That is
  expected noise; a failed production build deploys nothing.

### 1.4 Web Analytics for the new hostname

Cloudflare dashboard → Analytics & Logs → Web Analytics → Add a site → hostname
`scc.ryan-avocado-6a07yrtc.workers.dev` (JS snippet, not proxied). Put the token into the shell
on the rewrite branch (the beacon tag in `index.html`), commit, push.

The beacon is verified on **production** in 3.4, not on the Version URL: the token is bound to
the hostname by suffix match, so a `<alias>-scc.…workers.dev` preview may log a CORS error from
`cloudflareinsights.com`. That error is expected and harmless on the preview.

If the dashboard refuses a `workers.dev` hostname, record "field data: unavailable, hostname
rejected" in the verdict's field-data appendix and continue. Field data is reported, never
scored ([#183](https://github.com/rymanacevedo/SCC/issues/183)).

### 1.5 Freeze Netlify

Netlify dashboard → `sccc` → Project configuration → Build & deploy → Continuous deployment →
Build settings → **Stop builds**.

This keeps the current deploy published and keeps the Deploys list (needed for rollback) while
guaranteeing that the merge in 3.2, which removes `packages/frontend`, cannot trigger a Netlify
build. Do **not** unlink the repository: unlinking deletes deploy keys and hooks for nothing.
Manual CLI deploys (3.5) still work with builds stopped.

### 1.6 Push the rewrite branch and verify the Version URL

Push the rewrite branch to `origin`. Workers Builds runs the build and preview commands and
prints a Version URL of the form `https://<alias>-scc.ryan-avocado-6a07yrtc.workers.dev`.
Export it:

```bash
export GATE_ORIGIN="https://<alias>-scc.ryan-avocado-6a07yrtc.workers.dev"
```

Verify the deployed Worker before measuring it:

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

---

## Phase 2. Gate run

Everything here is on the rewrite branch, against `GATE_ORIGIN`. The rules are
[#183](https://github.com/rymanacevedo/SCC/issues/183); the commands are the
[#179](https://github.com/rymanacevedo/SCC/issues/179) runbook as executed for the baseline
([#180](https://github.com/rymanacevedo/SCC/issues/180)), with the origin swapped.

### 2.1 Flow test first

```bash
bun run test:e2e
```

Green is required before any Lighthouse collection ([#194](https://github.com/rymanacevedo/SCC/issues/194)).

### 2.2 Tag the attempt

The perf tooling refuses an untagged HEAD. Gate attempts are numbered; never reuse a number.

```bash
git tag remix-v3/gate-1            # gate-2, gate-3… for re-measurements after a fix
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
bun run build && bun run preview &             # Worker in workerd on http://localhost:5199
# 30-sample curl loop from #179 step 5 against http://localhost:5199/api/summaries
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

Outcomes, exactly as [#183](https://github.com/rymanacevedo/SCC/issues/183) rules:

- **PASS**: commit `$PERF_DIR` and the verdict on the rewrite branch. Record the date in the
  Dates table. Proceed to Phase 3.
- **Narrow timing miss** (FCP, LCP, TBT, or INP failing by less than twice its tolerance):
  re-collect that cell once with `--numberOfRuns=9`; those medians are final. Byte and CLS
  cells get no re-run.
- **FAIL**: fix the branch, push (a new Version URL appears), return to 2.1 with the next
  `gate-<n>` tag. The failed attempt's directory stays committed. Thresholds are never edited
  here; changing one needs a new ticket on the map.

---

## Phase 3. Cutover day

Run top to bottom without pausing between 3.2 and 3.7. Re-check Phase 0 first.

### 3.1 Open the PR

Open the rewrite branch's PR against `main` if not already open. Its description links the
passing gate directory. Nothing else is in flight on `main`.

### 3.2 Merge → rollback window opens

Merge the PR. From this moment until 3.7, a smoke failure is handled by the
[Rollback](#rollback) section.

### 3.3 Confirm the Workers Build deploy

Watch Workers & Pages → `scc` → Deployments. The build on `main` must go green and deploy.
Confirm from the machine:

```bash
bunx wrangler deployments list --name scc | head -20
```

The top deployment's source is the merge commit SHA. If the build fails (the first build of
`main` with the new layout is the one risk Workers Builds previews did not cover), use the
break-glass path, which produces the same artifact:

```bash
git switch main && git pull && bun install --frozen-lockfile && bun run build && bunx wrangler deploy
```

Then fix the Builds setting afterwards; the cutover does not wait for it.

### 3.4 Production smoke (six checks)

`PROD=https://scc.ryan-avocado-6a07yrtc.workers.dev`. Each check proves one route, secret, or
binding. All six must pass; one failure triggers the Rollback section.

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

Record the date in the Dates table.

### 3.5 Redirect Netlify

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

Both `301` to the Worker URL with the path preserved. Record the date.

Old-origin `sessionStorage` is not carried over, by design
([#182](https://github.com/rymanacevedo/SCC/issues/182),
[#192](https://github.com/rymanacevedo/SCC/issues/192)); a user mid-session on the old origin
lands on the new home page.

### 3.6 Re-check through the redirect

Open `https://sccc.netlify.app/summary` in a fresh browser tab: it must land on the Worker's
`/` (empty User redirects home) and suggestions must still work after filling a job. This is the
last check inside the rollback window.

### 3.7 Delete `scc-backend` → rollback window closes

```bash
bunx wrangler delete --name scc-backend      # answer the confirmation prompt if one appears
bunx wrangler deployments list --name scc-backend   # expect "not found"
```

Its secrets go with it. Record the date: **from here there is no rollback**. The 30-day Netlify
redirect is a courtesy for stale links, not a fallback.

### 3.8 Tag the cutover commit

```bash
git switch main && git pull
git tag remix-v3/cutover "$(git rev-parse HEAD)"     # HEAD is the merge commit from 3.2
```

Push the tag to `origin`.

### 3.9 Close the issues the migration resolved

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

On `main` at `remix-v3/cutover`, against production. Same method, same toolchain, same
fixtures as the gate.

```bash
git switch main && git checkout -q remix-v3/cutover
export PERF_TAG="$(git describe --tags --exact-match HEAD)"      # remix-v3/cutover
export PERF_DIR="docs/perf/remix-v3/cutover"
export PERF_ORIGIN="https://scc.ryan-avocado-6a07yrtc.workers.dev"
```

Run Phase 2.3 and 2.4 unchanged (the API cell is local again). Add to `meta.json`:
`"webAnalyticsSince"` for the new hostname and `"gateRun"` naming the passing gate directory.
Then:

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

Nothing else remains on the old path: `scc-backend` went in 3.7, the proxy routes and
`VITE_HONO_BACKEND_URL` went with the rewrite.

---

## Rollback

**Trigger**: one of the six checks in 3.4 (or the re-check in 3.6) fails. Performance never
triggers a rollback: a gate FAIL stops you before 3.2, and a report FAIL fixes forward.

**Window**: open at 3.2 (merge), closed at 3.7 (`scc-backend` deleted). Inside it, the previous
Netlify deploy and `scc-backend` both still exist, so the old site can be re-published intact.

**Steps**, in order:

1. If 3.5 has already run: Netlify dashboard → Deploys → the last deploy *before* the redirect
   (the frozen React Router build) → **Publish deploy**. Instant. With builds stopped, nothing
   can overwrite it. If 3.5 has not run, there is nothing to re-publish: Netlify is still
   serving the old site.
2. Verify `curl -s -o /dev/null -w '%{http_code}\n' https://sccc.netlify.app/summary` → `200`
   and that the old site's `/summary` still gets suggestions from `scc-backend`.
3. Leave `main` merged. Fix forward on `main`; each push redeploys `scc` through Workers Builds
   (nobody is on it yet).
4. Resume at 3.3. The rollback window is still open because 3.7 never ran.

Netlify's free tier keeps only the published deploy and the most recent successful production
deploy beyond 30 days, which is why the window is same-day: do not plan on re-publishing the old
site weeks later.

---

## Facts not confirmed by documentation

Checked against the Cloudflare and Netlify docs on 2026-10-13; these were not stated and are
handled defensively above. Confirm each the first time you hit it and strike it here.

- Whether "Enable Preview Builds" is on by default in Workers Builds (1.3 sets it explicitly).
- Whether Workers Builds picks Bun from `packageManager` (1.3 sets `BUN_VERSION`).
- Whether `wrangler delete` prompts for confirmation (3.7 runs it in a terminal).
- Whether Web Analytics accepts a `workers.dev` hostname (1.4 has the fallback).
- Whether a Netlify deploy with no `index.html` is accepted (3.5 ships one).
- Netlify's behaviour when the configured base directory is missing on the production branch
  (1.5 stops builds so it never applies).
