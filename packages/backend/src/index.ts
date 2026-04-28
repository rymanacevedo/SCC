import { zValidator } from '@hono/zod-validator';
import { type Context, Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import {
  EnvironmentValidationError,
  type EnvSchema,
  validateBaseEnvironment,
  validateGithubEnvironment,
  validateOpenAiEnvironment,
} from '../lib/environment';
import { createExperience, createSkills, createSummaries } from './services/ai';
import {
  createAutoReportedIssue,
  createUserReportedIssue,
  type ErrorTelemetry,
  errorTelemetrySchema,
  GitHubIssueCreationError,
  type UserIssueReport,
  userIssueReportSchema,
} from './services/github';

type IssueReportingCategory =
  | 'config'
  | 'github_http'
  | 'github_network'
  | 'unknown';

type Bindings = EnvSchema;

const app = new Hono<{
  Bindings: Bindings;
}>();

export const CorsConfig = async (c: Context, next: () => Promise<void>) => {
  const { ALLOWED_ORIGIN } = validateBaseEnvironment(c.env);
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

type IssueReportingPayload = ErrorTelemetry | UserIssueReport;

function classifyIssueReportingError(error: unknown): {
  category: IssueReportingCategory;
  status: 500 | 502;
} {
  if (error instanceof EnvironmentValidationError && error.scope === 'github') {
    return { category: 'config', status: 500 };
  }
  if (error instanceof GitHubIssueCreationError) {
    return {
      category: error.kind === 'http' ? 'github_http' : 'github_network',
      status: 502,
    };
  }
  return { category: 'unknown', status: 502 };
}

function logIssueReportingError({
  route,
  error,
  payload,
  category,
}: {
  route: '/api/errors' | '/api/report-issue';
  error: unknown;
  payload: IssueReportingPayload;
  category: IssueReportingCategory;
}) {
  const metadata = {
    route,
    category,
    message: error instanceof Error ? error.message : 'Unknown error',
    timestamp: payload.timestamp,
    url: payload.url,
  };

  if (error instanceof GitHubIssueCreationError) {
    console.error({
      ...metadata,
      githubStatus: error.status,
      githubResponseSnippet: error.details,
      causeMessage:
        error.cause instanceof Error ? error.cause.message : undefined,
    });
    return;
  }

  console.error(metadata);
}

app.post('/api/summaries', zValidator('json', schema), async (c) => {
  try {
    const { OPENAI_API_KEY } = validateOpenAiEnvironment(c.env);
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
    const { OPENAI_API_KEY } = validateOpenAiEnvironment(c.env);
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
    const { OPENAI_API_KEY } = validateOpenAiEnvironment(c.env);
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

app.post('/api/errors', zValidator('json', errorTelemetrySchema), async (c) => {
  const payload = c.req.valid('json');

  try {
    const { GITHUB_REPO, GITHUB_TOKEN } = validateGithubEnvironment(c.env);

    await createAutoReportedIssue({
      repo: GITHUB_REPO,
      token: GITHUB_TOKEN,
      payload,
    });

    return c.json({ ok: true });
  } catch (error) {
    const { category, status } = classifyIssueReportingError(error);
    logIssueReportingError({
      route: '/api/errors',
      error,
      payload,
      category,
    });
    return c.json({ error: 'Failed to report application error' }, status);
  }
});

app.post(
  '/api/report-issue',
  zValidator('json', userIssueReportSchema),
  async (c) => {
    const payload = c.req.valid('json');

    try {
      const { GITHUB_REPO, GITHUB_TOKEN } = validateGithubEnvironment(c.env);

      await createUserReportedIssue({
        repo: GITHUB_REPO,
        token: GITHUB_TOKEN,
        payload,
      });

      return c.json({ ok: true });
    } catch (error) {
      const { category, status } = classifyIssueReportingError(error);
      logIssueReportingError({
        route: '/api/report-issue',
        error,
        payload,
        category,
      });
      return c.json({ error: 'Failed to submit issue report' }, status);
    }
  },
);

export default app;
