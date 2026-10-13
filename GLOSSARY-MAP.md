# Glossary Map

SCC is split into contexts, each with its own bounded vocabulary. This map points to the per-context glossary (`GLOSSARY.md`). Before exploring a context's code, read its glossary and use those terms exactly — prefer them over synonyms.

| Context | Glossary | What lives here |
|---------|----------|-----------------|
| System | [`GLOSSARY.md`](GLOSSARY.md) | Terms spanning every context: the kinds of Test, Eval, Bake-off |
| Worker | [`worker/GLOSSARY.md`](worker/GLOSSARY.md) | Cloudflare Worker API: AI resume generation, GitHub issue reporting, environment validation |
| App | [`app/GLOSSARY.md`](app/GLOSSARY.md) | The section-by-section builder UI: builder pages, the User record, the Outline, Preview and Exports |

## Architectural decisions

- **System-wide** decisions live in `docs/adr/` at the repo root.
- **Context-specific** decisions live beside each context, e.g. [`worker/docs/adr/`](worker/docs/adr/) and [`app/docs/adr/`](app/docs/adr/).

Read the ADRs that touch the area you're about to work in before proposing changes there.
