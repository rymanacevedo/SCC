# AGENTS.md

## Project Snapshot

SCC is a resume building tool used for simple users who want structure and a way to write their resume easily and quickly. The app is broken down into sections and for each section the user will answer simple questions and the AI will generate a resume based on their answers. This ensures that the user can get their resume written in a short amount of time.

## Core Priorities

1. Performance first.
2. Reliability first.
3. Keep behavior predictable under load and during failures (session restarts, reconnects, partial streams).

If a tradeoff is required, choose correctness and robustness over short-term convenience.

## Maintainability

Long term maintainability is a core priority. If you add new functionality, first check if there is shared logic that can be extracted to a separate module. Duplicate logic across multiple files is a code smell and should be avoided. Don't be afraid to change existing code. Don't take shortcuts by just adding local logic to solve a problem.

## Commands

Run frontend: `bun run dev` in the `packages/frontend` directory. [DO NOT RUN UNLESS INSTRUCTED]
Run backend: `bun run dev` in the `packages/backend` directory. [DO NOT RUN UNLESS INSTRUCTED]

`bun test` don't run unless instructed