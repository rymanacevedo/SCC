import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { createSummaries } from './services/ai';

const app = new Hono();

app.use(cors());

const schema = z.object({
  prompt: z.string().min(1),
});

app.post(
  '/api/generate',
  zValidator('json', schema),

  async (c) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      console.log(apiKey)
      if (!apiKey) {
        console.error('GEMINI_API_KEY not set in environment variables');
        return c.json({ error: 'GEMINI_API_KEY not set' }, 500);
      }

      const { prompt } = c.req.valid('json');

      const response = await createSummaries(prompt);

      return c.json(response);
    } catch (error) {
      console.error('Error generating content:', error);
      return c.json(
        { error: 'Failed to generate content', details: error },
        500,
      );
    }
  },
);

export default app;
