# Issue #216: local Phase 0 verification

Branch: `sandcastle/issue-216-1791946225441`. Checked 2026-10-14.
This is evidence for the [cutover runbook](remix-v3-cutover.md), not authorization
or evidence for a deployed Gate. Issue #216 stays open for review.

| Phase 0 prerequisite | Evidence / disposition |
| --- | --- |
| #185 upgrades merged | Root package uses Zod 4, AI SDK 7, TypeScript 7, Vite 8, Cloudflare tooling, Bun 1.4.3; inherited merged upgrade history. |
| Complete rewrite | Single root package; `app/steps.ts` has the fixed twelve Steps through Preview; journey visits each. Both Exports create non-empty downloaded files. `worker/router.ts` owns five API POST routes. Contract tests cover them. |
| Worker config | `wrangler.jsonc`: `scc`, `/api/*` runs first, SPA fallback, observability enabled, `ALLOWED_COUNTRIES` and `GITHUB_REPO`. |
| Local verification | `bun run typecheck` passes; `bun run test`: 115 pass, 0 fail; `bun run test:e2e`: 3 pass, 0 fail across the two explicit Flow files. Bare test discovery excludes them; hooks never invoke them. |
| Baseline merged | `docs/perf/baseline/pre-remix-v3/summary.json` is present. |
| Verdict tooling | Baseline against itself using committed thresholds: `Overall: PASS`. Existing baseline re-extraction test reproduces App script byte medians exactly. This self-check is not the migration Gate. |
| Shared perf inputs | `flow.mjs` imports the stub response and seed fixture adapter from root `e2e/`. Seeds `scc:user` version 1 with User and Drafts. `cmp` of all three JSON fixtures against pre-move HEAD copies passed. Baseline User bytes stay intact; added prerequisites exist only in the adapter. |
| Web Analytics | Existing shell tag has `REPLACE_WITH_WORKER_ANALYTICS_TOKEN`; thresholds exclude only `static.cloudflareinsights.com`. Map #174 records #196 collecting since 2026-10-13; dashboard state remains dev-owned. |
| Node pin | `.node-version` reads `24`; local Node v24.21.0, Bun 1.4.3. Chrome 155.0.8059.39 is pinned once in `e2e/browser.json`, read by runner and perf script. |
| Dev machine credentials | Cloudflare login, Netlify linkage, jq and Gate browser environment remain dev-owned prerequisites. No remote deployment, PR, push or Gate attempted. |
| Runbook merged | `docs/runbooks/remix-v3-cutover.md` is present in inherited history. |

Carried-bug evidence:

- #171: `app/experience.test.tsx` checks stable row identity, DOM nodes and focus
  during typing, adding and removing, plus Draft reload.
- #150: `app/education.test.tsx` includes the education-flow regression reaching
  the next Step, id-addressed edits, guard redirects and four-digit year recovery.
- #173: root package contains no React Router; no React, React Router, Hono or
  Lexical package entries remain in the lockfile.
- #149: storage and API client use shared typed Results; storage failure and abort
  tests pass; home and finish-up disclose tab-scoped persistence.

## Dependency audit decision

[#229](https://github.com/rymanacevedo/SCC/issues/229) is closed; #203 and #216
permit removed packages solely as transitive dependencies of required packages.
Required `jspdf@4.2.1` retains optional `dompurify` in the lockfile. The root
package and app, Worker and shared source have no direct removed dependencies
or imports. The normal dependency graph and required exporters are preserved.

## Reproduce locally

```bash
bun run typecheck
bun run test
bun run test:e2e
node docs/perf/tools/verdict.mjs \
  --before docs/perf/baseline/pre-remix-v3/summary.json \
  --after docs/perf/baseline/pre-remix-v3/summary.json \
  --thresholds docs/perf/thresholds.json --out /tmp/scc-baseline-self-check.md
```
