---
status: accepted
date: 2026-10-13
---

# The resume page is a read-only Preview; the Outline is the single source for Preview and Exports

The pre-Remix-v3 resume page mounted a Lexical rich-text editor via `@lexical/react`, but its edits never reached the PDF or DOCX: both exporters built their output from the User record and ignored the editor, and there was no toolbar, so the page was a styled preview with a data-loss trap. Remix v3 removes React, which removes `@lexical/react`; keeping Lexical framework-free was feasible but carried the migration's one hard UI risk (Remix's reconciler versus a `contenteditable` subtree Lexical mutates), would still not feed the exports without a document model, and kept the resume page the heaviest page in the app. We decided the resume page is a **read-only Preview** rendered from the User, with an Edit link per Section back to its builder page, and that the Preview, PDF Export, and DOCX Export all render one shared **Outline** of semantic Blocks instead of each restating the resume's structure. Lexical, every `@lexical/*` package, and `dompurify` leave the frontend; the export libraries load on demand when an export button is clicked.

## Considered options

- **Lexical, framework-free, inside a Remix component.** Rejected: hard DOM-ownership risk needing a spike, no export round-trip without a document model, no bundle win.
- **Another editor or a hand-rolled `contenteditable`.** Rejected: more work than Lexical for the same non-result.
- **Read-only Preview.** Chosen: export-equivalent to the previous behaviour, no editor risk, best path to the required script-size cut on `/resume`, one source of truth (the builder pages are already the editing surface).

## Consequences

- Rich-text editing that round-trips into the exports is a future product effort, not part of the migration. It would start by extending the Outline, which exists for exactly that reason.
- The focus-loss bug (#171) lives on the experience-entry builder page, not the resume page; it is fixed in the rewrite by a stable per-row id, independent of this decision.

Decided in https://github.com/rymanacevedo/SCC/issues/184 (Remix v3 wayfinder map #174).
