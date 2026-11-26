import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evalEnvironmentSchema } from '../evals/env.ts';
import {
  environmentSchema,
  validateEnvironment,
  validateGeoEnvironment,
} from '../worker/lib/environment.ts';
import { checkValues, runVarlock, wranglerVars } from './environment-check.ts';
import {
  ROOT,
  SPAWN_TIMEOUT,
  STUB_SECRETS,
  useEnvironmentProjects,
} from './environment-fixture.ts';

const project = useEnvironmentProjects();

const CI_VALUES = { ...wranglerVars(ROOT), ...STUB_SECRETS };

interface LoadedSchema {
  output: string;
  keys: string[];
  secretKeys: string[];
}

let loaded: LoadedSchema | undefined;

function loadedSchema(): LoadedSchema {
  if (loaded) return loaded;

  const { directory, environment } = project();
  const run = runVarlock(
    directory,
    { ...environment, ...CI_VALUES, DEBUG: 'varlock*' },
    ['load', '--format', 'json-full'],
  );
  expect(run.status, run.output).toBe(0);

  const items: Record<string, { isSensitive: boolean }> = JSON.parse(
    run.stdout,
  ).config;
  const keys = Object.keys(items).sort();
  loaded = {
    output: run.output,
    keys,
    secretKeys: keys.filter((key) => items[key].isSensitive),
  };
  return loaded;
}

test(
  'the environment schema loads with the four required Worker keys and no values file',
  () => {
    expect(loadedSchema().keys).toEqual(expect.arrayContaining(workerKeys));
  },
  SPAWN_TIMEOUT,
);

test(
  'Varlock sends no telemetry from this repo',
  () => {
    const { output } = loadedSchema();
    expect(output).toMatch(/telemetry opted out - config file/);
    expect(output).not.toMatch(/handed off/);
  },
  SPAWN_TIMEOUT,
);

const workerKeys = Object.keys(environmentSchema.shape).sort();
const evalKeys = Object.keys(evalEnvironmentSchema.shape);

const ENVIRONMENT_OBJECT = String.raw`(?:process|Bun|import\.meta)\.env`;
const KEY = '[A-Z][A-Z0-9_]*';

function keysReadIn(source: string): string[] {
  const direct = source.matchAll(
    new RegExp(
      String.raw`${ENVIRONMENT_OBJECT}(?:\??\.(${KEY})\b|\??\.?\[\s*['"\`](${KEY})['"\`]\s*\])`,
      'g',
    ),
  );
  const destructured = source.matchAll(
    new RegExp(String.raw`\{([^{}]*)\}\s*=\s*${ENVIRONMENT_OBJECT}\b`, 'g'),
  );
  return [
    ...[...direct].map((match) => match[1] ?? match[2]),
    ...[...destructured].flatMap((match) =>
      match[1]
        .split(',')
        .map((property) => property.trim().split(/[\s:=]/)[0])
        .filter((property) => new RegExp(`^${KEY}$`).test(property)),
    ),
  ];
}

test('a key read from the environment is found in each form the code can read it', () => {
  expect(
    keysReadIn(`
      process.env.DOT_READ;
      process.env['BRACKET_READ'];
      process.env?.OPTIONAL_READ;
      Bun.env.BUN_READ ?? Bun.env["BUN_BRACKET_READ"];
      import.meta.env.META_READ;
      const { FIRST, RENAMED: local, WITH_DEFAULT = 'x', ...rest } = process.env;
      const env = { ...process.env, ONLY_SET: '1' };
      process.env[name];
    `),
  ).toEqual([
    'DOT_READ',
    'BRACKET_READ',
    'OPTIONAL_READ',
    'BUN_READ',
    'BUN_BRACKET_READ',
    'META_READ',
    'FIRST',
    'RENAMED',
    'WITH_DEFAULT',
  ]);
});

const INDIRECT_READS = [
  { file: 'docs/perf/tools/verdict.mjs', keys: ['PERF_DIR', 'PERF_TAG'] },
];
const OPERATING_SYSTEM_KEYS = ['PATH'];

function sourceFiles(): string[] {
  const listing = spawnSync(
    'git',
    [
      'ls-files',
      '-z',
      '--cached',
      '--others',
      '--exclude-standard',
      '--',
      '*.ts',
      '*.tsx',
      '*.js',
      '*.mjs',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  expect(
    listing.status,
    `This test lists source files with git ls-files, so it needs a git checkout and git on PATH. ${listing.error?.message ?? listing.stderr}`,
  ).toBe(0);
  return listing.stdout
    .split('\0')
    .filter((file) => file && !/\.test\.tsx?$/.test(file));
}

function read(file: string): string {
  return readFileSync(join(ROOT, file), 'utf8');
}

test('each indirect read still names its keys in its file', () => {
  for (const { file, keys } of INDIRECT_READS) {
    for (const key of keys) {
      expect(read(file), `${key} in ${file}`).toContain(key);
    }
  }
});

test('the environment schema declares every key the repo reads, and no others', () => {
  const keysRead = new Set([
    ...workerKeys,
    ...evalKeys,
    ...sourceFiles().flatMap((file) => keysReadIn(read(file))),
    ...INDIRECT_READS.flatMap(({ keys }) => keys),
  ]);
  for (const key of OPERATING_SYSTEM_KEYS) keysRead.delete(key);

  expect(loadedSchema().keys).toEqual([...keysRead].sort());
}, SPAWN_TIMEOUT);

test('the only key Evals read that the Worker does not is GEMINI_API_KEY', () => {
  expect(evalKeys.filter((key) => !workerKeys.includes(key))).toEqual([
    'GEMINI_API_KEY',
  ]);
});

test('the environment schema marks the four credentials as secrets and nothing else', () => {
  expect(loadedSchema().secretKeys).toEqual([
    'GEMINI_API_KEY',
    'GH_TOKEN',
    'GITHUB_TOKEN',
    'OPENAI_API_KEY',
  ]);
}, SPAWN_TIMEOUT);

test('every Wrangler var is a declared key that is not a secret', () => {
  const vars = Object.keys(wranglerVars(ROOT));
  const { keys, secretKeys } = loadedSchema();
  expect(vars.length).toBeGreaterThan(0);
  for (const key of vars) {
    expect(keys).toContain(key);
    expect(secretKeys).not.toContain(key);
  }
}, SPAWN_TIMEOUT);

const FLOW_TEST_VALUES = {
  ALLOWED_COUNTRIES: 'US',
  GITHUB_REPO: 'rymanacevedo/SCC',
  GITHUB_TOKEN: 'flow-stub',
  OPENAI_API_KEY: 'flow-stub',
  OPENAI_BASE_URL: 'http://127.0.0.1:8788/v1',
  OPENAI_MODEL: 'gpt-5-nano',
};

function workerAccepts(values: Record<string, string>): boolean {
  try {
    validateEnvironment(values);
    validateGeoEnvironment(values);
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

interface SchemaCase {
  name: string;
  values: Record<string, string>;
  workerAccepts: boolean;
  checkRejects?: { key: string; reason: RegExp; reportedBy?: 'check' };
}

function changed(
  name: string,
  change: Record<string, string>,
  workerAccepts: boolean,
  checkRejects?: SchemaCase['checkRejects'],
): SchemaCase {
  return {
    name,
    values: { ...FLOW_TEST_VALUES, ...change },
    workerAccepts,
    checkRejects,
  };
}

function missing(key: string): SchemaCase {
  const { [key]: _, ...values }: Record<string, string> = FLOW_TEST_VALUES;
  const required =
    !environmentSchema.shape[
      key as keyof typeof environmentSchema.shape
    ].safeParse(undefined).success;
  return {
    name: `values with no ${key}`,
    values,
    workerAccepts: !required,
    checkRejects: required
      ? { key, reason: /Value is required but is currently empty/ }
      : undefined,
  };
}

const MATCH = /must match regex/;

const SCHEMA_CASES: SchemaCase[] = [
  ...workerKeys.map(missing),
  changed('the values the Flow test runner writes', {}, true),
  changed(
    'lower-case country codes with spaces around them',
    { ALLOWED_COUNTRIES: ' us , ca ' },
    true,
  ),
  changed('a three-character token', { GITHUB_TOKEN: 'abc' }, true),
  changed(
    'an https base URL',
    { OPENAI_BASE_URL: 'https://api.example.com/v1' },
    true,
  ),
  changed(
    'a base URL with no slashes after its scheme',
    { OPENAI_BASE_URL: 'localhost:11434' },
    true,
  ),
  changed(
    'a base URL with spaces around it',
    { OPENAI_BASE_URL: ' https://api.example.com/v1 ' },
    true,
  ),
  changed('a model id with a slash', { OPENAI_MODEL: 'qwen/qwen3:8b' }, true),
  changed('a three-letter country code', { ALLOWED_COUNTRIES: 'USA' }, false, {
    key: 'ALLOWED_COUNTRIES',
    reason: MATCH,
  }),
  changed(
    'a country list with a trailing comma',
    { ALLOWED_COUNTRIES: 'US,' },
    false,
    { key: 'ALLOWED_COUNTRIES', reason: MATCH },
  ),
  changed(
    'a country list separated by spaces',
    { ALLOWED_COUNTRIES: 'US CA' },
    false,
    { key: 'ALLOWED_COUNTRIES', reason: MATCH },
  ),
  changed('a base URL that is not a URL', { OPENAI_BASE_URL: 'nope' }, false, {
    key: 'OPENAI_BASE_URL',
    reason: /Invalid URL/,
  }),
  changed(
    'a secret shorter than three characters',
    { GITHUB_TOKEN: 'ab' },
    true,
    { key: 'GITHUB_TOKEN', reason: /too short to redact safely/ },
  ),
  changed(
    'a country code that is two letters only once upper-cased',
    { ALLOWED_COUNTRIES: 'ß' },
    true,
    { key: 'ALLOWED_COUNTRIES', reason: MATCH },
  ),
  changed('an empty base URL', { OPENAI_BASE_URL: '' }, false, {
    key: 'OPENAI_BASE_URL',
    reason: /^Empty env vars: OPENAI_BASE_URL\./m,
    reportedBy: 'check',
  }),
  changed('an empty model id', { OPENAI_MODEL: '' }, false, {
    key: 'OPENAI_MODEL',
    reason: /^Empty env vars: OPENAI_MODEL\./m,
    reportedBy: 'check',
  }),
];

for (const schemaCase of SCHEMA_CASES) {
  const { name, values, checkRejects } = schemaCase;
  const agreement =
    schemaCase.workerAccepts === !checkRejects
      ? 'as the Worker does'
      : `which the Worker ${schemaCase.workerAccepts ? 'accepts' : 'rejects'}`;

  test(
    `the environment check ${checkRejects ? 'rejects' : 'accepts'} ${name}, ${agreement}`,
    () => {
      const { directory, environment } = project();
      const run = checkValues(directory, { ...environment, ...values });
      expect(workerAccepts(values)).toBe(schemaCase.workerAccepts);
      expect(run.status, run.output).toBe(checkRejects ? 1 : 0);
      if (checkRejects) {
        expect(
          checkRejects.reportedBy === 'check'
            ? run.output
            : problemLines(run.output, checkRejects.key),
        ).toMatch(checkRejects.reason);
      }
    },
    SPAWN_TIMEOUT,
  );
}
