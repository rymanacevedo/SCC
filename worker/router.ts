import type { LanguageModel } from 'ai';
import {
  createRouter,
  type Middleware,
  type RequestContext,
} from 'remix/router';
import type { z } from 'zod';
import { generationRequestSchema } from '../shared/schemas/generation.ts';
import {
  validateGeoEnvironment,
  validateGithubEnvironment,
  validateOpenAiEnvironment,
} from './lib/environment.ts';
import { apiError } from './lib/response.ts';
import {
  createRouteErrorMiddleware,
  type RouteErrorPolicy,
} from './middleware/errors.ts';
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
  userIssueReportSchema,
} from './services/github.ts';
import { resolveModel as defaultResolveModel } from './services/model.ts';

export function createApiRouter(
  env: object,
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
    schema: z.core.$ZodType<T>,
    handler: (payload: T) => Promise<Response>,
    errorPolicy: RouteErrorPolicy,
    guards: (
      key: ReturnType<typeof bodyValidation<T>>['key'],
    ) => Middleware[] = () => [],
  ) {
    const body = bodyValidation(schema);
    const errorGuard = createRouteErrorMiddleware(path, body.key, errorPolicy);
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
      {
        generation: true,
        errorMessage: 'Failed to generate content',
      },
      (key) => [createProfanityFilter(key)],
    );
  }
  generationRoute('/api/summaries', createSummaries);
  generationRoute('/api/skills', createSkills);
  generationRoute('/api/experience', createExperience);
  register(
    '/api/errors',
    errorTelemetrySchema,
    async (payload) => {
      const config = validateGithubEnvironment(env);
      await createAutoReportedIssue({
        repo: config.GITHUB_REPO,
        token: config.GITHUB_TOKEN,
        payload,
      });
      return Response.json({ ok: true });
    },
    { errorMessage: 'Failed to report application error' },
  );
  register(
    '/api/report-issue',
    userIssueReportSchema,
    async (payload) => {
      const config = validateGithubEnvironment(env);
      await createUserReportedIssue({
        repo: config.GITHUB_REPO,
        token: config.GITHUB_TOKEN,
        payload,
      });
      return Response.json({ ok: true });
    },
    { errorMessage: 'Failed to submit issue report' },
  );
  return router;
}
