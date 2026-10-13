import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

export const createDockerSandbox = () =>
  docker({
    env: {
      CODEX_HOME: sandboxCodexHome,
      GH_TOKEN: process.env.GH_TOKEN ?? '',
      HOME: '/home/agent',
      TMPDIR: sandboxTmpDir,
      BUN_INSTALL_CACHE_DIR: sandboxBunCacheDir,
      GIT_AUTHOR_NAME: 'Sandcastle',
      GIT_AUTHOR_EMAIL: 'sandcastle@localhost',
      GIT_COMMITTER_NAME: 'Sandcastle',
      GIT_COMMITTER_EMAIL: 'sandcastle@localhost',
    },
    mounts: [
      {
        hostPath: hostCodexHome,
        sandboxPath: sandboxCodexMount,
        readonly: true,
      },
    ],
  });

// Bound the number of simultaneous issue pipelines in each batch.
export const MAX_CONCURRENT_ISSUES = 3;

// Shared model for the implementation and review phases.
export const SANDCASTLE_MODEL = 'gpt-6.1-sol';

// Hooks run inside the sandbox before the agent starts each iteration.
// Install Linux-native dependencies there, not in the host checkout.
export const hooks = {
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
export const copyToWorktree = ['node_modules'];

export function prepareEnvironment(): string {
  loadSandcastleEnv();
  ensureHostCodexAuth();
  if (!process.env.GH_TOKEN) {
    throw new Error(
      'Set GH_TOKEN in .sandcastle/.env before starting Sandcastle.',
    );
  }
  execFileSync('gh', ['auth', 'status'], { stdio: 'ignore' });
  const baseBranch = execFileSync('git', ['branch', '--show-current'], {
    encoding: 'utf8',
  }).trim();
  if (!baseBranch) {
    throw new Error(
      'Check out the intended PR base branch before starting Sandcastle.',
    );
  }
  const changes = execFileSync(
    'git',
    ['status', '--porcelain', '--untracked-files=no'],
    { encoding: 'utf8' },
  ).trim();
  if (changes) {
    throw new Error(
      'Commit or stash tracked changes before starting Sandcastle.',
    );
  }
  return baseBranch;
}
