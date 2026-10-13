# Verdict tooling

Rules come from issues #183 and #198, implemented by #207. Changes to
`docs/perf/thresholds.json` require a new ticket on map #174.

Extract Tier 1 medians with `bash docs/perf/tools/extract-summary.sh <perf-dir>`.
An optional second argument selects the thresholds file. Extraction preserves
existing bundle, API, and flow entries in `summary.json`. It sums Script requests
from Lighthouse's network audit, excluding only the configured exact hosts from
App script bytes. Excluded transfers become Third-party script bytes in both
`summary.json` and `tier1.md`. Regression coverage re-extracts every committed
baseline report and checks every App script byte median for exact equality.

Generate the Verdict with:

```bash
node docs/perf/tools/verdict.mjs \
  --before docs/perf/baseline/pre-remix-v3/summary.json \
  --after docs/perf/remix-v3/gate-1/summary.json \
  --thresholds docs/perf/thresholds.json \
  --out docs/perf/verdict-remix-v3.md
```

Exit status is 0 for PASS, 1 for a scored FAIL (the Verdict is still written),
and 2 for invalid arguments, malformed input, or an invalid runbook tag.
When `PERF_TAG` or `PERF_DIR` is exported by the runbook, HEAD must be tagged;
a supplied `PERF_TAG` must point at HEAD. Offline fixture comparisons need no tag.

Each navigation and flow cell is compared independently. Missing scored values
fail; duplicate cells and incomplete baseline cell sets are rejected. Seeded
mobile navigation CLS uses the absolute 0.1 ceiling; other CLS cells use the
0.025 regression tolerance. Every Tier 1 shell and resume cell must meet the
25% byte reduction as well as the 5% regression bound. Timing narrow misses
remain FAIL and request one 9-run re-collection; 9-run misses are final. Byte
and CLS failures have no re-run allowance. Reported metrics and the bundle,
Worker bundle (`workerBundle`), and field-data (`fieldData`) appendix never fail.
Absent reported data is shown as unavailable. The historical baseline's absent
Third-party script bytes column is zero because it downloaded no excluded scripts.

For the acceptance self-check, supply the same baseline path to `--before` and
`--after`. The document explicitly identifies this as a baseline self-check and
omits improvement gates (the byte cut and seeded mobile CLS ceiling). This PASS
checks tooling and parity only; it cannot establish migration readiness. Distinct
before/after paths always enforce the improvement gates, even with equal data.

The perf tools package owns only Lighthouse. Puppeteer lives in the root dev
dependencies so the existing `flow.mjs` can resolve it without a second direct pin.
