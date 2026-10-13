import { APICallError, type LanguageModel } from 'ai';
import {
  createRouter,
  type Middleware,
  type RequestContext,
} from 'remix/router';
import type { z } from 'zod';
import { generationRequestSchema } from '../shared/schemas/generation.ts';
import {
  EnvironmentValidationError,
  validateGeoEnvironment,
  validateGithubEnvironment,
  validateOpenAiEnvironment,
} from './lib/environment.ts';
import { apiError } from './lib/response.ts';
import {
  bodyValidation,
  createGeoRestrictionMiddleware,
  createProfanityFilter,
  sameOriginGuard,
} from './middleware/guards.ts';
import {
  createExperience,
  createSkills,
  createSummaries,
} from './services/ai.ts';
import {
  createAutoReportedIssue,
  createUserReportedIssue,
  errorTelemetrySchema,
  GitHubIssueCreationError,
  userIssueReportSchema,
} from './services/github.ts';
import { resolveModel as defaultResolveModel } from './services/model.ts';

export function createApiRouter(
  env: Record<string, string>,
  {
    resolveModel = defaultResolveModel,
  }: { resolveModel?: typeof defaultResolveModel } = {},
) {
  const router = createRouter({
    defaultHandler: () => apiError(404, 'Not found'),
  });
  let geo: Middleware | undefined;
  const geoGuard: Middleware = (context, next) => {
    geo ??= createGeoRestrictionMiddleware(validateGeoEnvironment(env));
    return geo(context, next);
  };
  function register<T>(
    path: string,
    schema: z.ZodType<T>,
    handler: (payload: T) => Promise<Response>,
    generation = false,
    guards: (
      key: ReturnType<typeof bodyValidation<T>>['key'],
    ) => Middleware[] = () => [],
  ) {
    const body = bodyValidation(schema);
    const errorGuard: Middleware = async (context, next) => {
      try {
        return await next();
      } catch (error) {
        const payload = context.get(body.key);
        const reportMetadata =
          !generation &&
          payload &&
          typeof payload === 'object' &&
          'timestamp' in payload &&
          'url' in payload
            ? { timestamp: payload.timestamp, url: payload.url }
            : {};
        const config = error instanceof EnvironmentValidationError;
        const github = error instanceof GitHubIssueCreationError;
        const provider = APICallError.isInstance(error);
        const category = config
          ? 'config'
          : github
            ? `github_${error.kind}`
            : provider
              ? 'provider'
              : 'unknown';
        const status = config
          ? 500
          : github || provider || !generation
            ? 502
            : 500;
        // biome-ignore lint/suspicious/noConsole: Categorized failures belong in Workers Logs.
        console.error({
          route: path,
          category,
          ...reportMetadata,
          name: error instanceof Error ? error.name : undefined,
          stack: error instanceof Error ? error.stack : undefined,
          causeMessage:
            error instanceof Error && error.cause instanceof Error
              ? error.cause.message
              : undefined,
          message: error instanceof Error ? error.message : String(error),
          ...(github
            ? {
                githubStatus: error.status,
                githubResponseSnippet: error.details,
              }
            : {}),
          ...(provider
            ? {
                providerStatus: error.statusCode,
                providerUrl: error.url,
                isRetryable: error.isRetryable,
              }
            : {}),
        });
        return apiError(
          status,
          generation
            ? 'Failed to generate content'
            : path === '/api/errors'
              ? 'Failed to report application error'
              : 'Failed to submit issue report',
        );
      }
    };
    const methodGuard: Middleware = ({ request }, next) =>
      request.method === 'POST'
        ? next()
        : apiError(405, 'Method not allowed', undefined, { Allow: 'POST' });
    // ANY lets routing decide 405 before security or body checks, with a JSON envelope.
    router.route('ANY', path, {
      middleware: [
        methodGuard,
        errorGuard,
        sameOriginGuard,
        geoGuard,
        body.middleware,
        ...guards(body.key),
      ],
      handler: (context: RequestContext) => {
        const payload = context.get(body.key);
        if (payload === undefined)
          throw new Error('Missing validated request body');
        return handler(payload);
      },
    });
  }
  function generationRoute(
    path: string,
    generate: (prompt: string, model: LanguageModel) => Promise<unknown>,
  ) {
    register(
      path,
      generationRequestSchema,
      async ({ prompt }) =>
        Response.json(
          await generate(prompt, resolveModel(validateOpenAiEnvironment(env))),
        ),
      true,
      (key) => [createProfanityFilter(key)],
    );
  }
  generationRoute('/api/summaries', createSummaries);
  generationRoute('/api/skills', createSkills);
  generationRoute('/api/experience', createExperience);
  register('/api/errors', errorTelemetrySchema, async (payload) => {
    const config = validateGithubEnvironment(env);
    await createAutoReportedIssue({
      repo: config.GITHUB_REPO,
      token: config.GITHUB_TOKEN,
      payload,
    });
    return Response.json({ ok: true });
  });
  register('/api/report-issue', userIssueReportSchema, async (payload) => {
    const config = validateGithubEnvironment(env);
    await createUserReportedIssue({
      repo: config.GITHUB_REPO,
      token: config.GITHUB_TOKEN,
      payload,
    });
    return Response.json({ ok: true });
  });
  return router;
}
