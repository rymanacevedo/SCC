import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

const evalEnvironmentSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
});

export type EvalEnvironment = z.infer<typeof evalEnvironmentSchema>;

function parseDotEnv(contents: string): Record<string, string> {
  const entries = contents
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => {
      const separatorIndex = line.indexOf('=');

      if (separatorIndex === -1) {
        throw new Error(`Invalid .dev.vars entry: ${line}`);
      }

      return [
        line.slice(0, separatorIndex).trim(),
        line.slice(separatorIndex + 1).trim(),
      ] as const;
    });

  return Object.fromEntries(entries);
}

export async function loadEvalEnvironment(
  backendDirectory: string,
): Promise<EvalEnvironment> {
  const envPath = join(backendDirectory, '.dev.vars');
  const contents = await readFile(envPath, 'utf8');

  return evalEnvironmentSchema.parse(parseDotEnv(contents));
}

export async function applyEvalEnvironment(
  backendDirectory: string,
): Promise<EvalEnvironment> {
  const environment = await loadEvalEnvironment(backendDirectory);

  Object.assign(process.env, environment);

  return environment;
}
