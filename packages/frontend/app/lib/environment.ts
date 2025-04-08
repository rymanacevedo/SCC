import { z } from 'zod';

const schema = z.object({
  VITE_HONO_BACKEND_URL: z.string().url().min(1),
});

type EnvSchema = z.infer<typeof schema>;

let env: EnvSchema;
try {
  env = schema.parse(import.meta.env);
} catch (error) {
  throw new Error(
    'Invalid environment variables.  See console for details. Are you pointing to VITE_HONO_BACKEND_URL in env variables?',
  );
}

export const { VITE_HONO_BACKEND_URL } = env;
