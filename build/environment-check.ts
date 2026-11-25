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

function asText(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function wranglerVars(directory: string): Record<string, string> {
  const { vars } = unstable_readConfig({
    config: join(directory, WRANGLER_CONFIG),
  });

  return Object.fromEntries(
    Object.entries(vars).map(([key, value]) => [key, asText(value)]),
  );
}

export function localWorkerValues(directory: string): Record<string, string> {
  const configPath = join(directory, WRANGLER_CONFIG);
  const { vars } = unstable_readConfig({ config: configPath });
  const bindings = unstable_getVarsForDev(
    configPath,
    undefined,
    vars,
    undefined,
    true,
  );

  return Object.fromEntries(
    Object.entries(bindings).map(([key, binding]) => [
      key,
      asText(binding.value),
    ]),
  );
}

export function checkEnvironment(
  directory: string,
  ambient: Record<string, string | undefined>,
): { status: number; output: string } {
  const run = spawnSync(VARLOCK, ['load'], {
    cwd: directory,
    encoding: 'utf8',
    env: { ...ambient, ...localWorkerValues(directory) },
  });

  return { status: run.status ?? 1, output: run.stdout + run.stderr };
}

if (import.meta.main) {
  const { status, output } = checkEnvironment(process.cwd(), process.env);

  process.stdout.write(output);
  process.exit(status);
}
