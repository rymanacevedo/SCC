import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { unstable_getVarsForDev, unstable_readConfig } from 'wrangler';
import { environmentSchema } from '../worker/lib/environment.ts';

const VARLOCK = join(
  import.meta.dirname,
  '..',
  'node_modules',
  '.bin',
  'varlock',
);
const WRANGLER_CONFIG = 'wrangler.jsonc';

type Environment = Record<string, string | undefined>;

function textValues(values: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      typeof value === 'string' ? value : JSON.stringify(value),
    ]),
  );
}

function readWranglerConfig(directory: string) {
  const path = join(directory, WRANGLER_CONFIG);

  return { path, vars: unstable_readConfig({ config: path }).vars };
}

export function wranglerVars(directory: string): Record<string, string> {
  return textValues(readWranglerConfig(directory).vars);
}

export function localWorkerValues(directory: string): Record<string, string> {
  const { path, vars } = readWranglerConfig(directory);
  const bindings = unstable_getVarsForDev(path, undefined, vars, undefined, true);

  return textValues(
    Object.fromEntries(
      Object.entries(bindings).map(([key, binding]) => [key, binding.value]),
    ),
  );
}

export function runVarlock(
  directory: string,
  environment: Environment,
  args: string[] = ['load'],
): { status: number; stdout: string; output: string } {
  const run = spawnSync(VARLOCK, args, {
    cwd: directory,
    encoding: 'utf8',
    env: environment,
  });

  if (run.error) {
    return {
      status: 1,
      stdout: '',
      output: `Could not run ${VARLOCK}: ${run.error.message}\n`,
    };
  }

  return {
    status: run.status ?? 1,
    stdout: run.stdout,
    output: run.stdout + run.stderr,
  };
}

function emptyWorkerKeys(values: Environment): string[] {
  return Object.entries(environmentSchema.shape)
    .filter(
      ([key, schema]) => values[key] === '' && !schema.safeParse('').success,
    )
    .map(([key]) => key);
}

export function checkValues(
  directory: string,
  values: Environment,
): { status: number; output: string } {
  const { status, output } = runVarlock(directory, values);
  const emptyKeys = emptyWorkerKeys(values);

  if (emptyKeys.length === 0) return { status, output };

  return {
    status: 1,
    output: `${output}Empty env vars: ${emptyKeys.join(', ')}. The Worker rejects an empty string: remove the key or give it a value.\n`,
  };
}

export function checkEnvironment(
  directory: string,
  processEnvironment: Environment,
): { status: number; output: string } {
  return checkValues(directory, {
    ...processEnvironment,
    ...localWorkerValues(directory),
  });
}

if (import.meta.main) {
  const { status, output } = checkEnvironment(process.cwd(), process.env);

  process.stdout.write(output);
  process.exit(status);
}
