import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { unstable_getVarsForDev, unstable_readConfig } from 'wrangler';

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

  return {
    status: run.status ?? 1,
    stdout: run.stdout,
    output: run.stdout + run.stderr,
  };
}

export function checkEnvironment(
  directory: string,
  processEnvironment: Environment,
): { status: number; output: string } {
  return runVarlock(directory, {
    ...processEnvironment,
    ...localWorkerValues(directory),
  });
}

if (import.meta.main) {
  const { status, output } = checkEnvironment(process.cwd(), process.env);

  process.stdout.write(output);
  process.exit(status);
}
