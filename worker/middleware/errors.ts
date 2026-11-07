import { APICallError } from 'ai';
import type { Middleware } from 'remix/router';
import {
  sanitizeTelemetryText,
  toPathOnlyUrl,
} from '../../shared/telemetryRedaction.ts';
import { isClientAbort } from '../lib/abort.ts';
import { EnvironmentValidationError } from '../lib/environment.ts';
import { apiError } from '../lib/response.ts';
import { GitHubIssueCreationError } from '../services/github.ts';
import type { bodyValidation } from './guards.ts';

// Caps for one Workers Logs line. Each field is redacted before it is cut.
const LOG_FIELD_MAX = { url: 2_000, message: 1_000, stack: 4_000 } as const;

/** Redacts and truncates a logged value; non-strings are logged as they are. */
function logText(value: unknown, max: number = LOG_FIELD_MAX.message) {
  return typeof value === 'string' ? sanitizeTelemetryText(value, max) : value;
}

function logUrl(value: unknown) {
  return typeof value === 'string'
    ? sanitizeTelemetryText(toPathOnlyUrl(value), LOG_FIELD_MAX.url)
    : value;
}

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
              timestamp: logText(payload.timestamp),
              url: logUrl(payload.url),
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
        name: error instanceof Error ? logText(error.name) : undefined,
        stack:
          error instanceof Error
            ? logText(error.stack, LOG_FIELD_MAX.stack)
            : undefined,
        causeMessage:
          error instanceof Error && error.cause instanceof Error
            ? logText(error.cause.message)
            : undefined,
        message: logText(
          error instanceof Error ? error.message : String(error),
        ),
        ...(isGitHubError
          ? {
              githubStatus: error.status,
              githubResponseSnippet: logText(error.details),
            }
          : {}),
        ...(isProviderError
          ? {
              providerStatus: error.statusCode,
              providerUrl: logUrl(error.url),
              isRetryable: error.isRetryable,
            }
          : {}),
      });
      return apiError(status, errorMessage);
    }
  };
}
