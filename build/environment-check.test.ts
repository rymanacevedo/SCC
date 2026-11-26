import { expect, test } from 'bun:test';
import { join } from 'node:path';
import {
  checkEnvironment,
  localWorkerValues,
  runVarlock,
  wranglerVars,
} from './environment-check.ts';
import {
  SPAWN_TIMEOUT,
  STUB_SECRETS,
  WRANGLER_VARS,
  useEnvironmentProjects,
} from './environment-fixture.ts';

const project = useEnvironmentProjects();

const LOCAL_SECRETS = 'OPENAI_API_KEY=local-key\nGITHUB_TOKEN=local-token\n';

test('Wrangler vars are the vars in wrangler.jsonc as text, without .dev.vars', () => {
  const { directory } = project({
    vars: { ...WRANGLER_VARS, RETRIES: 3, REGIONS: ['us', 'ca'] },
    devVars: 'ALLOWED_COUNTRIES=CA\nOPENAI_API_KEY=local-key\n',
  });

  expect(wranglerVars(directory)).toEqual({
    ...WRANGLER_VARS,
    RETRIES: '3',
    REGIONS: '["us","ca"]',
  });
});

test('local Worker values are the Wrangler vars with .dev.vars laid over them', () => {
  const { directory } = project({
    devVars: 'OPENAI_API_KEY="quoted key"\nALLOWED_COUNTRIES=CA\n',
  });

  expect(localWorkerValues(directory)).toEqual({
    ALLOWED_COUNTRIES: 'CA',
    GITHUB_REPO: 'owner/repo',
    OPENAI_API_KEY: 'quoted key',
  });
});

test('the environment check passes on Wrangler vars plus the secrets in .dev.vars', () => {
  const { directory, environment } = project({ devVars: LOCAL_SECRETS });

  const run = checkEnvironment(directory, environment);

  expect(run.status, run.output).toBe(0);
}, SPAWN_TIMEOUT);

test('the environment check passes with no .dev.vars when the process environment holds the secrets, as in CI', () => {
  const { directory, environment } = project();

  const run = checkEnvironment(directory, { ...environment, ...STUB_SECRETS });

  expect(run.status, run.output).toBe(0);
}, SPAWN_TIMEOUT);

test('the environment check fails on a .dev.vars that lacks a required secret, naming it', () => {
  const { directory, environment } = project({
    devVars: 'OPENAI_API_KEY=local-key\n',
  });

  const run = checkEnvironment(directory, environment);

  expect(run.status, run.output).toBe(1);
  expect(run.output).toMatch(/Invalid env vars: GITHUB_TOKEN/);
}, SPAWN_TIMEOUT);

test('the environment check fails on a malformed value in .dev.vars even when the process environment holds a good one', () => {
  const { directory, environment } = project({
    devVars: `${LOCAL_SECRETS}OPENAI_BASE_URL=nope\n`,
  });

  const run = checkEnvironment(directory, {
    ...environment,
    OPENAI_BASE_URL: 'https://api.example.com/v1',
  });

  expect(run.status, run.output).toBe(1);
  expect(run.output).toMatch(/Invalid env vars: OPENAI_BASE_URL/);
}, SPAWN_TIMEOUT);

for (const key of ['OPENAI_BASE_URL', 'OPENAI_MODEL']) {
  test(`the environment check fails on a .dev.vars that sets ${key} to an empty string, naming it`, () => {
    const { directory, environment } = project({
      devVars: `${LOCAL_SECRETS}${key}=\n`,
    });

    const run = checkEnvironment(directory, environment);

    expect(run.status, run.output).toBe(1);
    expect(run.output).toMatch(new RegExp(`Empty env vars: ${key}\\.`));
  }, SPAWN_TIMEOUT);
}

test('running Varlock reports a failure to start it instead of throwing', () => {
  const { directory, environment } = project();

  const run = runVarlock(join(directory, 'missing'), environment);

  expect(run.status).toBe(1);
  expect(run.stdout).toBe('');
  expect(run.output).toMatch(/Could not run .*varlock: .*ENOENT/);
}, SPAWN_TIMEOUT);
