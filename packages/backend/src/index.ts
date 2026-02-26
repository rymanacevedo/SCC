import { zValidator } from '@hono/zod-validator';
import { type Context, Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { validateEnvironment } from '../lib/environment';
import { createExperience, createSkills, createSummaries } from './services/ai';

type Bindings = {
  ALLOWED_ORIGIN: string;
  GEMINI_API_KEY: string;
  GROQ_API_KEY: string;
  GITHUB_TOKEN?: string;
  GITHUB_REPO?: string;
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

const bugReportSchema = z.object({
  description: z.string().min(1),
  url: z.string().url(),
});

app.post('/api/bugs', zValidator('json', bugReportSchema), async (c) => {
  try {
    const { GITHUB_TOKEN, GITHUB_REPO } = validateEnvironment(c.env);
    if (!GITHUB_TOKEN || !GITHUB_REPO) {
      return c.json({ error: 'GitHub configuration missing' }, 500);
    }

    const { description, url } = c.req.valid('json');
    const title =
      description.length > 70 ? `${description.slice(0, 67)}...` : description;

    const body = `## Bug Report\n\n**URL:** ${url}\n\n**Description:**\n${description}\n\n---\n_Auto-reported from the application_`;

    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/issues`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          body,
          labels: ['bug'],
        }),
      },
    );

    if (!res.ok) {
      return c.json({ error: 'Failed to create GitHub issue' }, 500);
    }

    return c.json({ success: true });
  } catch {
    return c.json({ error: 'Failed to submit bug report' }, 500);
  }
});

export default app;
