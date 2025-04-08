import { z } from 'zod';

const schema = z.object({
  ALLOWED_ORIGIN: z.string().url().min(1),
  GEMINI_API_KEY: z.string().min(1),
});

type EnvSchema = z.infer<typeof schema>;

let env: EnvSchema;

export function validateEnvironment(envFromContext: any) {
  try {
    env = schema.parse(envFromContext);
    return env;
  } catch (error) {
    throw new Error('Invalid environment variables. Is .dev.vars available?');
  }
}
