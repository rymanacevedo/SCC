# Flow tests

Run `bun run test:e2e` from the repo root. It builds the app, installs Chrome for
Testing from `browser.json` into ignored `.cache/scc-chrome` on demand, starts the
OpenAI-compatible stub and Vite preview (Worker in workerd), runs the two explicit
`.e2e.ts` paths, and restores `.dev.vars` and removes temporary downloads.

Ports 8788 and 5199 must be free. Test targets are fixed localhost URLs; no deployed
origin argument is accepted. The country file is supplied to Miniflare through
`CLOUDFLARE_CF_FETCH_PATH`. Model credentials are placeholders. Browser requests to
third-party hosts are answered locally, including the analytics beacon. The
separate dev-run perf Gate loads analytics normally.

`bun run test` does not discover these filenames. Flow tests are never in hooks.
Fixtures moved byte-for-byte from the baseline perf tooling. `fixtures.ts` adds
the new prerequisites only while seeding the versioned storage envelope.
