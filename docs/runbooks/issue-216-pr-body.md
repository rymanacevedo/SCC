## Summary

Implements the local Flow runner and Phase 0 integration evidence for #216,
under migration PRD [#203](https://github.com/rymanacevedo/SCC/issues/203) and
map [#174](https://github.com/rymanacevedo/SCC/issues/174).

```text
bun run test:e2e
  build app + Worker
  install pinned Chrome on demand
  start local model stub + vite preview/workerd
  journey: all Steps → Preview → PDF + DOCX
  history: Summary POST → Back/Forward + Revisit + unavailable Suggestions
  stop processes + restore .dev.vars
```

The perf flow shares root fixtures and the browser pin, and seeds the versioned
User envelope. Fixture bytes are unchanged. Preview interaction uses Revisit
because the editor was removed by the migration's Preview decision.

Prior art: [prototype branch](https://github.com/rymanacevedo/SCC/tree/proto/remix-v3-summary),
[release research](https://github.com/rymanacevedo/SCC/tree/research/remix-v3-release-status),
[Workers research](https://github.com/rymanacevedo/SCC/tree/research/remix-v3-on-cloudflare-workers),
[UI research](https://github.com/rymanacevedo/SCC/tree/research/remix-v3-ui-model-and-editor),
[measurement research](https://github.com/rymanacevedo/SCC/tree/research/site-speed-measurement-method),
[package research](https://github.com/rymanacevedo/SCC/tree/research/package-upgrade-landscape),
[Eval research](https://github.com/rymanacevedo/SCC/tree/research/eval-harness-replacement).
See the [runbook](remix-v3-cutover.md) and [local Phase 0 evidence](issue-216-phase-0.md).

## Evidence

- **Before:** `test:e2e` exited through a placeholder; perf seeded the old storage key
  and required a removed editor.
  **After:** typecheck passes, 115 regular Tests pass, and all 3 Flow cases pass,
  including non-empty PDF/DOCX downloads from the built app in workerd.
- Fixture `cmp` passes; baseline Verdict self-check is `Overall: PASS`.
- [#229](https://github.com/rymanacevedo/SCC/issues/229) permits jsPDF's optional
  transitive DOMPurify dependency; removed packages have no direct dependencies
  or source imports. This draft makes no deployment or Gate claim; the dev opens
  the PR and runs the Gate.

## Merge Danger

**Door:** two-way

**Blast Radius:** tooling

Fixed localhost ports fail when occupied; `.dev.vars` is restored after success
or failure. First run downloads the pinned Chrome; test traffic and model calls
remain local. The existing analytics beacon is suppressed only in Flow tests,
not in the perf Gate.
