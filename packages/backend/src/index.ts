import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { createSummaries } from './services/ai';

const app = new Hono<{
  Bindings: {
    ALLOWED_ORIGIN: string;
    GEMINI_API_KEY: string;
  };
}>();

app.use(
  '/api/*',
  cors({
    origin: '*',
  }),
);

const schema = z.object({
  prompt: z.string().min(1),
});

app.post('/api/generate', zValidator('json', schema), async (c) => {
  try {
    const apiKey = c.env.GEMINI_API_KEY;
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

export default app;
