import { afterEach, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkEnvironment, localWorkerValues } from './environment-check.ts';

const ROOT = join(import.meta.dirname, '..');
const projects: string[] = [];

afterEach(() => {
  for (const dir of projects.splice(0)) {
    rmSync(dir, { recursive: true });
  }
});

function project(devVars?: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'scc-env-check-'));
  projects.push(dir);
  cpSync(join(ROOT, '.env.schema'), join(dir, '.env.schema'));
  cpSync(join(ROOT, '.varlock'), join(dir, '.varlock'), { recursive: true });
  writeFileSync(
    join(dir, 'wrangler.jsonc'),
    JSON.stringify({
      name: 'scc-env-check',
      vars: { ALLOWED_COUNTRIES: 'US', GITHUB_REPO: 'owner/repo' },
    }),
  );
  if (devVars !== undefined) {
    writeFileSync(join(dir, '.dev.vars'), devVars);
  }
  return dir;
}

const AMBIENT = { PATH: process.env.PATH ?? '' };

test('local Worker values are the Wrangler vars with .dev.vars laid over them', () => {
  const dir = project(
    ['OPENAI_API_KEY="quoted key"', 'ALLOWED_COUNTRIES=CA', ''].join('\n'),
  );

  expect(localWorkerValues(dir)).toEqual({
    ALLOWED_COUNTRIES: 'CA',
    GITHUB_REPO: 'owner/repo',
    OPENAI_API_KEY: 'quoted key',
  });
});

test('the environment check passes on Wrangler vars plus the secrets in .dev.vars', () => {
  const dir = project('OPENAI_API_KEY=local-key\nGITHUB_TOKEN=local-token\n');

  const run = checkEnvironment(dir, AMBIENT);

  expect(run.status, run.output).toBe(0);
});

test('the environment check passes with no .dev.vars when the process environment holds the secrets, as in CI', () => {
  const run = checkEnvironment(project(), {
    ...AMBIENT,
    OPENAI_API_KEY: 'ci-stub-openai-key',
    GITHUB_TOKEN: 'ci-stub-token',
  });

  expect(run.status, run.output).toBe(0);
});

test('the environment check fails on a .dev.vars that lacks a required secret, naming it', () => {
  const run = checkEnvironment(project('OPENAI_API_KEY=local-key\n'), AMBIENT);

  expect(run.status, run.output).toBe(1);
  expect(run.output).toMatch(/Invalid env vars: GITHUB_TOKEN/);
});

test('the environment check fails on a malformed value in .dev.vars even when the process environment holds a good one', () => {
  const run = checkEnvironment(
    project(
      'OPENAI_API_KEY=local-key\nGITHUB_TOKEN=local-token\nOPENAI_BASE_URL=nope\n',
    ),
    { ...AMBIENT, OPENAI_BASE_URL: 'https://api.example.com/v1' },
  );

  expect(run.status, run.output).toBe(1);
  expect(run.output).toMatch(/Invalid env vars: OPENAI_BASE_URL/);
});
