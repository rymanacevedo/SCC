# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

**This repo uses a multi-context layout.** `CONTEXT-MAP.md` at the root points to one `CONTEXT.md` per package.

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repo root — it points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **`packages/<package>/CONTEXT.md`** — the per-context glossary for the package you're working in.
- **`docs/adr/`** at the root for system-wide decisions, and **`packages/<package>/docs/adr/`** for context-scoped decisions. Read ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

Multi-context layout (this repo):

```
/
├── CONTEXT-MAP.md
├── docs/adr/                          ← system-wide decisions
└── packages/
    ├── backend/
    │   ├── CONTEXT.md
    │   └── docs/adr/                  ← context-specific decisions
    ├── frontend/
    │   ├── CONTEXT.md
    │   └── docs/adr/
    └── shared/
        ├── CONTEXT.md
        └── docs/adr/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in the relevant `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
