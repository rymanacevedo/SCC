# Context Map

SCC is split into packages, each with its own bounded vocabulary. This map points to the per-package glossary (`CONTEXT.md`). Before exploring a package's code, read its glossary and use those terms exactly — prefer them over synonyms.

| Context | Glossary | What lives here |
|---------|----------|-----------------|
| Backend | [`packages/backend/CONTEXT.md`](packages/backend/CONTEXT.md) | Cloudflare Workers + Hono API: AI resume generation, GitHub issue reporting, environment validation |
| Frontend | _not yet documented_ | React Router app: the section-by-section builder UI |
| Shared | _not yet documented_ | Cross-package types and utilities |

## Architectural decisions

- **System-wide** decisions live in `docs/adr/` at the repo root.
- **Context-specific** decisions live under each package, e.g. [`packages/backend/docs/adr/`](packages/backend/docs/adr/).

Read the ADRs that touch the area you're about to work in before proposing changes there.
