import { z } from 'zod';

export const baseEnvironmentSchema = z.object({
  ALLOWED_ORIGIN: z.string().url().min(1),
});

export const githubEnvironmentSchema = z.object({
  GITHUB_REPO: z.string().min(1),
  GITHUB_TOKEN: z.string().min(1),
});

export const openAiEnvironmentSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
});

export const environmentSchema = baseEnvironmentSchema
  .extend(githubEnvironmentSchema.shape)
  .extend(openAiEnvironmentSchema.shape);

export type BaseEnvSchema = z.infer<typeof baseEnvironmentSchema>;
export type GithubEnvSchema = z.infer<typeof githubEnvironmentSchema>;
export type OpenAiEnvSchema = z.infer<typeof openAiEnvironmentSchema>;
export type EnvSchema = z.infer<typeof environmentSchema>;

export type EnvScope = 'base' | 'github' | 'openai' | 'all';

export class EnvironmentValidationError extends Error {
  scope: EnvScope;

  constructor(scope: EnvScope, cause: unknown) {
    super(`Invalid ${scope} environment variables.`, { cause });
    this.name = 'EnvironmentValidationError';
    this.scope = scope;
  }
}

function parseEnvironment<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  envFromContext: Record<string, string>,
  scope: EnvScope,
): z.infer<z.ZodObject<T>> {
  try {
    return schema.parse(envFromContext);
  } catch (error) {
    throw new EnvironmentValidationError(scope, error);
  }
}

export function validateBaseEnvironment(
  envFromContext: Record<string, string>,
): BaseEnvSchema {
  return parseEnvironment(baseEnvironmentSchema, envFromContext, 'base');
}

export function validateGithubEnvironment(
  envFromContext: Record<string, string>,
): GithubEnvSchema {
  return parseEnvironment(githubEnvironmentSchema, envFromContext, 'github');
}

export function validateOpenAiEnvironment(
  envFromContext: Record<string, string>,
): OpenAiEnvSchema {
  return parseEnvironment(openAiEnvironmentSchema, envFromContext, 'openai');
}

export function validateEnvironment(
  envFromContext: Record<string, string>,
): EnvSchema {
  return parseEnvironment(environmentSchema, envFromContext, 'all');
}
