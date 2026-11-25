import { afterEach, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { wranglerVars } from '../build/environment-check.ts';
import { evalEnvironmentSchema } from '../evals/env.ts';
import {
  environmentSchema,
  validateEnvironment,
  validateGeoEnvironment,
} from '../worker/lib/environment.ts';

const ROOT = join(import.meta.dirname, '..');
const VARLOCK = join(ROOT, 'node_modules', '.bin', 'varlock');

const sandboxes: string[] = [];

afterEach(() => {
  for (const dir of sandboxes.splice(0)) {
    rmSync(dir, { recursive: true });
  }
});

function sandbox(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  sandboxes.push(dir);
  return dir;
}

function varlock(
  env: Record<string, string>,
  extra: Record<string, string> = {},
  args: string[] = ['load'],
) {
  const dir = sandbox('scc-env-schema-');
  cpSync(join(ROOT, '.env.schema'), join(dir, '.env.schema'));
  cpSync(join(ROOT, '.varlock'), join(dir, '.varlock'), { recursive: true });
  const run = spawnSync(VARLOCK, args, {
    cwd: dir,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH ?? '',
      HOME: sandbox('scc-env-home-'),
      ...env,
      ...extra,
    },
  });
  return {
    status: run.status,
    stdout: run.stdout,
    output: run.stdout + run.stderr,
  };
}

const STUB_SECRETS = {
  GITHUB_TOKEN: 'ci-stub-token',
  OPENAI_API_KEY: 'ci-stub-openai-key',
};

const WORKER_VALUES = {
  ALLOWED_COUNTRIES: 'US',
  GITHUB_REPO: 'rymanacevedo/SCC',
  ...STUB_SECRETS,
};

test('the environment schema loads with the four required Worker keys and no values file', () => {
  const run = varlock(WORKER_VALUES);
  expect(run.status, run.output).toBe(0);
});

test('Varlock sends no telemetry from this repo', () => {
  const run = varlock(WORKER_VALUES, { DEBUG: 'varlock*' });
  expect(run.output).toMatch(/telemetry opted out - config file/);
  expect(run.output).not.toMatch(/handed off/);
});

const declared: Record<string, { isSensitive: boolean }> = JSON.parse(
  varlock(WORKER_VALUES, {}, ['load', '--format', 'json-full']).stdout,
).config;
const declaredKeys = Object.keys(declared).sort();
const sensitiveKeys = declaredKeys.filter((key) => declared[key].isSensitive);
const workerKeys = Object.keys(environmentSchema.shape).sort();
const evalOnlyKeys = Object.keys(evalEnvironmentSchema.shape).filter(
  (key) => !workerKeys.includes(key),
);

test('the environment schema declares the keys the Worker validates plus the eval-only key, and no others', () => {
  expect(declaredKeys).toEqual([...workerKeys, ...evalOnlyKeys].sort());
  expect(evalOnlyKeys).toEqual(['GEMINI_API_KEY']);
});

test('the environment schema marks the three API credentials as secrets and nothing else', () => {
  expect(sensitiveKeys).toEqual([
    'GEMINI_API_KEY',
    'GITHUB_TOKEN',
    'OPENAI_API_KEY',
  ]);
});

test('every Wrangler var is a declared key that is not a secret', () => {
  const vars = Object.keys(wranglerVars(ROOT));
  expect(vars.length).toBeGreaterThan(0);
  for (const key of vars) {
    expect(declaredKeys).toContain(key);
    expect(sensitiveKeys).not.toContain(key);
  }
});

const E2E_VALUES = {
  ALLOWED_COUNTRIES: 'US',
  GITHUB_REPO: 'rymanacevedo/SCC',
  GITHUB_TOKEN: 'flow-stub',
  OPENAI_API_KEY: 'flow-stub',
  OPENAI_BASE_URL: 'http://127.0.0.1:8788/v1',
  OPENAI_MODEL: 'gpt-5-nano',
};

function without(key: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(E2E_VALUES).filter(([name]) => name !== key),
  );
}

function workerAccepts(env: Record<string, string>): boolean {
  try {
    validateEnvironment(env);
    validateGeoEnvironment(env);
    return true;
  } catch {
    return false;
  }
}

function problemLines(output: string, key: string): string {
  const lines = output.split('\n');
  const start = lines.findIndex((line) =>
    new RegExp(`^\\S+ ${key}\\*?(\\s|$)`).test(line),
  );
  if (start === -1) return '';
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => !line.startsWith(' '));
  return rest.slice(0, end === -1 ? undefined : end).join('\n');
}

const REQUIRED = /Value is required but is currently empty/;

for (const key of workerKeys) {
  const required =
    !environmentSchema.shape[
      key as keyof typeof environmentSchema.shape
    ].safeParse(undefined).success;

  test(`the environment schema ${required ? 'requires' : 'does not require'} ${key}, as the Worker does`, () => {
    const run = varlock(without(key));
    expect(workerAccepts(without(key))).toBe(!required);
    expect(run.status, run.output).toBe(required ? 1 : 0);
    if (required) {
      expect(problemLines(run.output, key)).toMatch(REQUIRED);
    }
  });
}

test('the environment schema loads without the eval-only key', () => {
  expect(E2E_VALUES).not.toHaveProperty('GEMINI_API_KEY');
  expect(varlock(E2E_VALUES).status).toBe(0);
});

interface Verdict {
  name: string;
  env: Record<string, string>;
  key: string;
  reason: RegExp;
}

const REJECTED_AS_THE_WORKER_DOES: Verdict[] = [
  {
    name: 'a three-letter country code',
    env: { ALLOWED_COUNTRIES: 'USA' },
    key: 'ALLOWED_COUNTRIES',
    reason: /must match regex/,
  },
  {
    name: 'a country list with a trailing comma',
    env: { ALLOWED_COUNTRIES: 'US,' },
    key: 'ALLOWED_COUNTRIES',
    reason: /must match regex/,
  },
  {
    name: 'a country list separated by spaces',
    env: { ALLOWED_COUNTRIES: 'US CA' },
    key: 'ALLOWED_COUNTRIES',
    reason: /must match regex/,
  },
  {
    name: 'a base URL that is not a URL',
    env: { OPENAI_BASE_URL: 'nope' },
    key: 'OPENAI_BASE_URL',
    reason: /Invalid URL/,
  },
];

for (const { name, env, key, reason } of REJECTED_AS_THE_WORKER_DOES) {
  test(`the environment schema rejects ${name}, naming ${key}`, () => {
    const values = { ...E2E_VALUES, ...env };
    const run = varlock(values);
    expect(workerAccepts(values)).toBe(false);
    expect(run.status, run.output).toBe(1);
    expect(problemLines(run.output, key)).toMatch(reason);
  });
}

const ACCEPTED_AS_THE_WORKER_DOES: Pick<Verdict, 'name' | 'env'>[] = [
  { name: 'the values the Flow test runner writes', env: {} },
  {
    name: 'lower-case country codes with spaces around them',
    env: { ALLOWED_COUNTRIES: ' us , ca ' },
  },
  { name: 'a three-character token', env: { GITHUB_TOKEN: 'abc' } },
  {
    name: 'an https base URL',
    env: { OPENAI_BASE_URL: 'https://api.example.com/v1' },
  },
  {
    name: 'a base URL with no slashes after its scheme',
    env: { OPENAI_BASE_URL: 'localhost:11434' },
  },
  {
    name: 'a base URL with spaces around it',
    env: { OPENAI_BASE_URL: ' https://api.example.com/v1 ' },
  },
  { name: 'a model id with a slash', env: { OPENAI_MODEL: 'qwen/qwen3:8b' } },
];

for (const { name, env } of ACCEPTED_AS_THE_WORKER_DOES) {
  test(`the environment schema accepts ${name}`, () => {
    const values = { ...E2E_VALUES, ...env };
    expect(workerAccepts(values)).toBe(true);
    expect(varlock(values).status).toBe(0);
  });
}

const STRICTER_THAN_THE_WORKER: Verdict[] = [
  {
    name: 'a secret shorter than three characters',
    env: { GITHUB_TOKEN: 'ab' },
    key: 'GITHUB_TOKEN',
    reason: /too short to redact safely/,
  },
  {
    name: 'a country code that is two letters only once upper-cased',
    env: { ALLOWED_COUNTRIES: 'ß' },
    key: 'ALLOWED_COUNTRIES',
    reason: /must match regex/,
  },
];

for (const { name, env, key, reason } of STRICTER_THAN_THE_WORKER) {
  test(`the environment schema rejects ${name}, which the Worker accepts`, () => {
    const values = { ...E2E_VALUES, ...env };
    const run = varlock(values);
    expect(workerAccepts(values)).toBe(true);
    expect(run.status, run.output).toBe(1);
    expect(problemLines(run.output, key)).toMatch(reason);
  });
}

const LOOSER_THAN_THE_WORKER: Pick<Verdict, 'name' | 'env'>[] = [
  { name: 'an empty base URL', env: { OPENAI_BASE_URL: '' } },
  { name: 'an empty model id', env: { OPENAI_MODEL: '' } },
];

for (const { name, env } of LOOSER_THAN_THE_WORKER) {
  test(`the environment schema accepts ${name}, which the Worker rejects`, () => {
    const values = { ...E2E_VALUES, ...env };
    expect(workerAccepts(values)).toBe(false);
    expect(varlock(values).status).toBe(0);
  });
}
