import { zValidator } from '@hono/zod-validator';
import { type Context, Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import {
  EnvironmentValidationError,
  type EnvSchema,
  validateBaseEnvironment,
  validateGeoEnvironment,
  validateGithubEnvironment,
  validateOpenAiEnvironment,
} from '../lib/environment';
import { createGeoRestrictionMiddleware } from './middleware/geo-restriction';
import { createExperience, createSkills, createSummaries } from './services/ai';
import { resolveModel } from './services/model';
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

const geoRestrictionMiddlewareCache = new Map<
  string,
  ReturnType<typeof createGeoRestrictionMiddleware>
>();

export const GeoRestrictionConfig = async (
  c: Context<{ Bindings: Bindings }>,
  next: () => Promise<void>,
) => {
  const { ALLOWED_COUNTRIES } = c.env;
  let geoRestrictionMiddleware =
    geoRestrictionMiddlewareCache.get(ALLOWED_COUNTRIES);

  if (!geoRestrictionMiddleware) {
    const { allowedCountries } = validateGeoEnvironment(c.env);
    geoRestrictionMiddleware = createGeoRestrictionMiddleware({
      allowedCountries,
    });
    geoRestrictionMiddlewareCache.set(
      ALLOWED_COUNTRIES,
      geoRestrictionMiddleware,
    );
  }

  return geoRestrictionMiddleware(c, next);
};

app.use('/api/*', GeoRestrictionConfig);
app.use('/api/*', CorsConfig);

const schema = z.object({
  prompt: z.string().min(1),
});

type IssueReportingPayload = ErrorTelemetry | UserIssueReport;
type AiGenerator = (
  prompt: string,
  model: ReturnType<typeof resolveModel>,
) => Promise<unknown>;

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

function logAiRouteError(
  route: '/api/summaries' | '/api/skills' | '/api/experience',
  error: unknown,
) {
  console.error({
    route,
    message: error instanceof Error ? error.message : 'Unknown error',
  });
}

function createAiRoute(
  route: '/api/summaries' | '/api/skills' | '/api/experience',
  generate: AiGenerator,
) {
  return async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const env = validateOpenAiEnvironment(c.env);
      const model = resolveModel(env);
      const { prompt } = c.req.valid('json' as never) as z.infer<typeof schema>;
      const response = await generate(prompt, model);
      return c.json(response);
    } catch (error) {
      logAiRouteError(route, error);
      return c.json({ error: 'Failed to generate content' }, 500);
    }
  };
}

app.post(
  '/api/summaries',
  zValidator('json', schema),
  createAiRoute('/api/summaries', createSummaries),
);

app.post(
  '/api/skills',
  zValidator('json', schema),
  createAiRoute('/api/skills', createSkills),
);

app.post(
  '/api/experience',
  zValidator('json', schema),
  createAiRoute('/api/experience', createExperience),
);

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
