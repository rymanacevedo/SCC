import type { LanguageModel } from 'ai';
import {
  createRouter,
  type Middleware,
  type RequestContext,
} from 'remix/router';
import type { z } from 'zod';
import { REPORT_FIELD_LIMITS } from '../shared/errorReporting.ts';
import { FLAGS_PATH } from '../shared/flags.ts';
import {
  generationRequestSchema,
  MAX_PROMPT_LENGTH,
} from '../shared/schemas/generation.ts';
import { handleFlagsRequest } from './flags-route.ts';
import { jsonBodyLimit } from './lib/body.ts';
import {
  validateGeoEnvironment,
  validateGithubEnvironment,
  validateOpenAiEnvironment,
} from './lib/environment.ts';
import { lazy } from './lib/lazy.ts';
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

// Each route's Body limit follows from the string caps its schema enforces.
const { timestamp, url, message, stackTrace, description } =
  REPORT_FIELD_LIMITS;
const generationBodyLimit = jsonBodyLimit(MAX_PROMPT_LENGTH);
const errorTelemetryBodyLimit = jsonBodyLimit(
  timestamp + url + message + stackTrace,
);
const userIssueReportBodyLimit = jsonBodyLimit(timestamp + url + description);

export function createApiRouter(
  env: object,
  {
    resolveModel = defaultResolveModel,
  }: { resolveModel?: typeof defaultResolveModel } = {},
) {
  const router = createRouter({
    defaultHandler: () => apiError(404, 'Not found'),
  });
  // Each router serves one env, so config is validated once, on first use by a
  // route that needs it. A missing variable stays a per-route failure.
  const geo = lazy(() =>
    createGeoRestrictionMiddleware(validateGeoEnvironment(env)),
  );
  const geoGuard: Middleware = (context, next) => geo()(context, next);
  const model = lazy(() => resolveModel(validateOpenAiEnvironment(env)));
  const github = lazy(() => validateGithubEnvironment(env));
  function register<T>(
    path: string,
    schema: z.core.$ZodType<T>,
    maxBodyBytes: number,
    handler: (payload: T, request: Request) => Promise<Response>,
    errorPolicy: RouteErrorPolicy,
    guards: (
      key: ReturnType<typeof bodyValidation<T>>['key'],
    ) => Middleware[] = () => [],
  ) {
    const body = bodyValidation(schema, maxBodyBytes);
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
        return handler(payload, context.request);
      },
    });
  }
  function generationRoute(
    path: string,
    generate: (
      prompt: string,
      model: LanguageModel,
      abortSignal: AbortSignal,
    ) => Promise<unknown>,
  ) {
    register(
      path,
      generationRequestSchema,
      generationBodyLimit,
      // A client that disconnects cancels the provider call instead of paying for it.
      async ({ prompt }, request) =>
        Response.json(await generate(prompt, model(), request.signal)),
      {
        generation: true,
        errorMessage: 'Failed to generate content',
      },
      (key) => [createProfanityFilter(key)],
    );
  }
  // Public, read-only, no body: the route answers 405 for anything but GET.
  router.route('ANY', FLAGS_PATH, {
    handler: ({ request }) => handleFlagsRequest(request, env),
  });
  generationRoute('/api/summaries', createSummaries);
  generationRoute('/api/skills', createSkills);
  generationRoute('/api/experience', createExperience);
  register(
    '/api/errors',
    errorTelemetrySchema,
    errorTelemetryBodyLimit,
    async (payload) => {
      const config = github();
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
    userIssueReportBodyLimit,
    async (payload) => {
      const config = github();
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
