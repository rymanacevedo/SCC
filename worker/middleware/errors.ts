import { APICallError } from 'ai';
import type { Middleware } from 'remix/router';
import { isClientAbort } from '../lib/abort.ts';
import { EnvironmentValidationError } from '../lib/environment.ts';
import { apiError } from '../lib/response.ts';
import { GeneratedOutputLimitError } from '../services/ai.ts';
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
          ? { timestamp: payload.timestamp, url: payload.url }
          : {};
      const isConfigurationError = error instanceof EnvironmentValidationError;
      const isGitHubError = error instanceof GitHubIssueCreationError;
      const isProviderError = APICallError.isInstance(error);
      // The model answered, but with more than a section can hold: a bad upstream result.
      const isOutputLimitError = error instanceof GeneratedOutputLimitError;
      let category = 'unknown';
      if (isConfigurationError) {
        category = 'config';
      } else if (isGitHubError) {
        category = `github_${error.kind}`;
      } else if (isProviderError) {
        category = 'provider';
      } else if (isOutputLimitError) {
        category = 'generated_output_limit';
      }

      let status = 500;
      if (
        !isConfigurationError &&
        (isGitHubError || isProviderError || isOutputLimitError || !generation)
      ) {
        status = 502;
      }
      // oxlint-disable-next-line no-console -- Categorized failures belong in Workers Logs.
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
        ...(isGitHubError
          ? {
              githubStatus: error.status,
              githubResponseSnippet: error.details,
            }
          : {}),
        ...(isProviderError
          ? {
              providerStatus: error.statusCode,
              providerUrl: error.url,
              isRetryable: error.isRetryable,
            }
          : {}),
      });
      return apiError(status, errorMessage);
    }
  };
}
