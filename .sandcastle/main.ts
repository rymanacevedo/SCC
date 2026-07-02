// Sequential Reviewer — implement-then-review loop
//
// This template drives a two-phase workflow per issue:
//   Phase 1 (Implement): A sonnet agent picks an open issue, works on it
//                        on a dedicated branch, commits the changes, and signals
//                        completion.
//   Phase 2 (Review):    A second sonnet agent reviews the branch diff and either
//                        approves it or makes corrections directly on the branch.
//
// Both phases share a single sandbox created via createSandbox(), so the
// implementer and reviewer work on the same explicit branch.
//
// The outer loop repeats up to MAX_ITERATIONS times, processing one issue per
// iteration and stopping early once the backlog is exhausted (an implement
// phase that produces no commits). This is a middle-complexity option between
// the simple-loop (no review gate) and the parallel-planner (concurrent
// execution with a planning phase).
//
// Usage:
//   npx tsx .sandcastle/main.ts
// Or add to package.json:
//   "scripts": { "sandcastle": "npx tsx .sandcastle/main.ts" }

import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as sandcastle from '@ai-hero/sandcastle';
import { docker } from '@ai-hero/sandcastle/sandboxes/docker';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const loadSandcastleEnv = () => {
  const envPath = path.resolve('.sandcastle/.env');
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) {
      continue;
    }

    process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
};

loadSandcastleEnv();

// Codex subscription auth: mount the host Codex home read-only, then copy the
// auth files into the writable sandbox home before Codex starts.
const hostCodexHome = path.join(os.homedir(), '.codex');
const sandboxCodexMount = '/mnt/host-codex';
const sandboxCodexHome = '/home/agent/.codex';
const sandboxTmpDir = '/home/agent/tmp';
const sandboxBunCacheDir = '/home/agent/.bun-cache';

const ensureHostCodexAuth = () => {
  const authPath = path.join(hostCodexHome, 'auth.json');
  if (!existsSync(authPath)) {
    throw new Error(
      `Codex subscription auth not found at ${authPath}. Run Codex login on the host before running Sandcastle.`,
    );
  }
};

const createDockerSandbox = () =>
  docker({
    env: {
      CODEX_HOME: sandboxCodexHome,
      GH_TOKEN: process.env.GH_TOKEN ?? '',
      HOME: '/home/agent',
      TMPDIR: sandboxTmpDir,
      BUN_INSTALL_CACHE_DIR: sandboxBunCacheDir,
    },
    mounts: [
      {
        hostPath: hostCodexHome,
        sandboxPath: sandboxCodexMount,
        readonly: true,
      },
    ],
  });

// Maximum number of implement→review cycles to run before stopping.
// Each cycle works on one issue. Raise this to process more issues per run.
const MAX_ITERATIONS = 10;

// Hooks run inside the sandbox before the agent starts each iteration.
// Install Linux-native dependencies there, not in the host checkout.
const hooks = {
  sandbox: {
    onSandboxReady: [
      {
        command: [
          `mkdir -p ${sandboxCodexHome}`,
          `mkdir -p ${sandboxTmpDir} ${sandboxBunCacheDir}`,
          `test -f "${sandboxCodexMount}/auth.json"`,
          `cp "${sandboxCodexMount}/auth.json" "${sandboxCodexHome}/auth.json"`,
          `if [ -f "${sandboxCodexMount}/config.toml" ]; then cp "${sandboxCodexMount}/config.toml" "${sandboxCodexHome}/config.toml"; fi`,
        ].join(' && '),
      },
      {
        command: 'bash .sandcastle/setup-sandbox.sh --skip-auth',
        timeoutMs: 600_000,
      },
    ],
  },
};

// Copy node_modules from the host into the worktree before each sandbox
// starts. The setup hook verifies Linux-native packages and reinstalls with Bun
// if the copied host dependencies are not usable in the container.
const copyToWorktree = ['node_modules'];

ensureHostCodexAuth();

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
  console.log(`\n=== Iteration ${iteration}/${MAX_ITERATIONS} ===\n`);

  // Generate a unique branch name for this iteration.
  const branch = `sandcastle/sequential-reviewer/${Date.now()}`;

  // Create a single sandbox that both the implementer and reviewer share.
  // This gives both agents a real, named branch that persists across phases.
  const sandbox = await sandcastle.createSandbox({
    branch,
    sandbox: createDockerSandbox(),
    hooks,
    copyToWorktree,
  });

  try {
    // -----------------------------------------------------------------------
    // Phase 1: Implement
    //
    // A sonnet agent picks the next open issue, writes the
    // implementation (using RGR: Red → Green → Repeat → Refactor), and
    // commits the result.
    //
    // The agent signals completion via <promise>COMPLETE</promise> when done.
    // -----------------------------------------------------------------------
    // One iteration so each outer pass implements a single issue on its own
    // branch, then hands it to the reviewer. A higher value lets the agent
    // drain the whole backlog onto this one branch in a single pass, which
    // defeats the per-issue review.
    const implement = await sandbox.run({
      name: 'implementer',
      maxIterations: 1,
      agent: sandcastle.codex('gpt-5.4'),
      promptFile: './.sandcastle/implement-prompt.md',
    });

    if (!implement.commits.length) {
      // No commits means the backlog is empty or every remaining issue is
      // blocked — there is nothing left to implement or review, so stop.
      console.log('Implementation agent made no commits. Stopping.');
      break;
    }

    console.log(`\nImplementation complete on branch: ${branch}`);
    console.log(`Commits: ${implement.commits.length}`);

    // -----------------------------------------------------------------------
    // Phase 2: Review
    //
    // A second sonnet agent reviews the diff of the branch produced by
    // Phase 1. It uses the {{BRANCH}} prompt argument to inspect the right
    // branch, and either approves or makes corrections directly on the branch.
    // -----------------------------------------------------------------------
    await sandbox.run({
      name: 'reviewer',
      maxIterations: 1,
      agent: sandcastle.codex('gpt-5.4'),
      promptFile: './.sandcastle/review-prompt.md',
      promptArgs: {
        BRANCH: branch,
      },
    });

    console.log('\nReview complete.');
  } finally {
    await sandbox.close();
  }
}

console.log('\nAll done.');
