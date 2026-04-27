import { z } from 'zod';

export const environmentSchema = z.object({
  ALLOWED_ORIGIN: z.string().url().min(1),
  GITHUB_REPO: z.string().min(1),
  GITHUB_TOKEN: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
});

export type EnvSchema = z.infer<typeof environmentSchema>;

let env: EnvSchema;

export function validateEnvironment(
  envFromContext: Record<string, string>,
): EnvSchema {
  try {
    env = environmentSchema.parse(envFromContext);
    return env;
  } catch (error) {
    throw new Error('Invalid environment variables. Is .dev.vars available?');
  }
}
