import { expect, test } from 'bun:test';
import {
  checkEnvironment,
  localWorkerValues,
  wranglerVars,
} from './environment-check.ts';
import {
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
});

test('the environment check passes with no .dev.vars when the process environment holds the secrets, as in CI', () => {
  const { directory, environment } = project();

  const run = checkEnvironment(directory, { ...environment, ...STUB_SECRETS });

  expect(run.status, run.output).toBe(0);
});

test('the environment check fails on a .dev.vars that lacks a required secret, naming it', () => {
  const { directory, environment } = project({
    devVars: 'OPENAI_API_KEY=local-key\n',
  });

  const run = checkEnvironment(directory, environment);

  expect(run.status, run.output).toBe(1);
  expect(run.output).toMatch(/Invalid env vars: GITHUB_TOKEN/);
});

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
});
