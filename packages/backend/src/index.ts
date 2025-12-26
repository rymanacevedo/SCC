import { type Context, Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { createExperience, createSkills, createSummaries } from './services/ai';
import { validateEnvironment } from '../lib/environment';

type Bindings = {
  ALLOWED_ORIGIN: string;
  GEMINI_API_KEY: string;
  GROQ_API_KEY: string;
};

const app = new Hono<{
  Bindings: Bindings;
}>();

export const CorsConfig = async (c: Context, next: () => Promise<void>) => {
  const { ALLOWED_ORIGIN } = validateEnvironment(c.env);
  const corsConfig = cors({
    origin: [ALLOWED_ORIGIN],
    allowMethods: ['POST', 'OPTIONS'],
  });
  return corsConfig(c, next);
};

app.use('/api/*', CorsConfig);

const schema = z.object({
  prompt: z.string().min(1),
});

app.post('/api/summaries', zValidator('json', schema), async (c) => {
  try {
    const { OPENAI_API_KEY } = validateEnvironment(c.env);
    const apiKey = OPENAI_API_KEY;
    if (!apiKey) {
      return c.json({ error: 'API key configuration error' }, 500);
    }

    const { prompt } = c.req.valid('json');
    const response = await createSummaries(prompt, apiKey);
    return c.json(response);
  } catch (error) {
    return c.json({ error: 'Failed to generate content' }, 500);
  }
});

app.post('/api/skills', zValidator('json', schema), async (c) => {
  try {
    const { OPENAI_API_KEY } = validateEnvironment(c.env);
    const apiKey = OPENAI_API_KEY;
    if (!apiKey) {
      return c.json({ error: 'API key configuration error' }, 500);
    }

    const { prompt } = c.req.valid('json');
    const response = await createSkills(prompt, apiKey);
    return c.json(response);
  } catch (error) {
    return c.json({ error: 'Failed to generate content' }, 500);
  }
});

app.post('/api/experience', zValidator('json', schema), async (c) => {
  try {
    const { OPENAI_API_KEY } = validateEnvironment(c.env);
    const apiKey = OPENAI_API_KEY;
    if (!apiKey) {
      return c.json({ error: 'API key configuration error' }, 500);
    }

    const { prompt } = c.req.valid('json');
    const response = await createExperience(prompt, apiKey);
    return c.json(response);
  } catch (error) {
    return c.json({ error: `Failed to generate content: ${error}` }, 500);
  }
});

export default app;
