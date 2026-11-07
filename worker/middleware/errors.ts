import { APICallError } from 'ai';
import type { Middleware } from 'remix/router';
import { isClientAbort } from '../lib/abort.ts';
import { EnvironmentValidationError } from '../lib/environment.ts';
import {
  describeErrorForLog,
  redactForLog,
  redactUrlForLog,
  timestampForLog,
} from '../lib/log.ts';
import { apiError } from '../lib/response.ts';
import { GitHubIssueCreationError } from '../services/github.ts';
import type { bodyValidation } from './guards.ts';

export type RouteErrorPolicy = {
  generation?: boolean;
  errorMessage: string;
};

export function createRouteErrorMiddleware<T>(
  path: string,
  key: ReturnType<typeof bodyValidation<T>>['key'],
  { generation = false, errorMessage }: RouteErrorPolicy,
): Middleware {
  return async (context, next) => {
    try {
      return await next();
    } catch (error) {
      // A disconnect is not a route failure. The Worker entry logs it once.
      if (isClientAbort(context.request, error)) throw error;
      const payload = context.get(key);
      const reportMetadata =
        !generation &&
        payload &&
        typeof payload === 'object' &&
        'timestamp' in payload &&
        'url' in payload
          ? {
              // Valid ISO, but unbounded in length: logged in canonical form.
              timestamp: timestampForLog(payload.timestamp),
              url: redactUrlForLog(payload.url),
            }
          : {};
      const isConfigurationError = error instanceof EnvironmentValidationError;
      const isGitHubError = error instanceof GitHubIssueCreationError;
      const isProviderError = APICallError.isInstance(error);
      let category = 'unknown';
      if (isConfigurationError) {
        category = 'config';
      } else if (isGitHubError) {
        category = `github_${error.kind}`;
      } else if (isProviderError) {
        category = 'provider';
      }

      let status = 500;
      if (
        !isConfigurationError &&
        (isGitHubError || isProviderError || !generation)
      ) {
        status = 502;
      }
      // oxlint-disable-next-line no-console -- Categorized failures belong in Workers Logs.
      console.error({
        route: path,
        category,
        ...reportMetadata,
        ...describeErrorForLog(error),
        ...(isGitHubError
          ? {
              githubStatus: error.status,
              githubResponseSnippet: redactForLog(error.details),
            }
          : {}),
        ...(isProviderError
          ? {
              providerStatus: error.statusCode,
              providerUrl: redactUrlForLog(error.url),
              isRetryable: error.isRetryable,
            }
          : {}),
      });
      return apiError(status, errorMessage);
    }
  };
}
