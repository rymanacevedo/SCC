import { APICallError, RetryError } from 'ai';
import type { Middleware } from 'remix/router';
import { isClientAbort } from '../lib/abort.ts';
import { UpstreamTimeoutError } from '../lib/deadline.ts';
import { EnvironmentValidationError } from '../lib/environment.ts';
import {
  describeErrorForLog,
  logToken,
  redactUrlForLog,
  timestampForLog,
} from '../lib/log.ts';
import { apiError } from '../lib/response.ts';
import {
  GeneratedOutputLimitError,
  SectionTokenLimitError,
} from '../services/ai.ts';
import {
  GitHubIssueCreationError,
  type GitHubIssueCreationErrorKind,
} from '../services/github.ts';
import type { bodyValidation } from './guards.ts';

export type RouteErrorPolicy = {
  unknownErrorStatus: 500 | 502;
  logReportMetadata: boolean;
  errorMessage: string;
};

export function createRouteErrorMiddleware<T>(
  path: string,
  key: ReturnType<typeof bodyValidation<T>>['key'],
  { unknownErrorStatus, logReportMetadata, errorMessage }: RouteErrorPolicy,
): Middleware {
  return async (context, next) => {
    try {
      return await next();
    } catch (error) {
      if (isClientAbort(context.request, error)) throw error;
      const payload = logReportMetadata ? context.get(key) : undefined;
      const reportMetadata =
        payload &&
        typeof payload === 'object' &&
        'timestamp' in payload &&
        'url' in payload
          ? {
              timestamp: timestampForLog(payload.timestamp),
              url: redactUrlForLog(payload.url),
            }
          : {};
      const { category, status, details } = classifyRouteError(
        error,
        unknownErrorStatus,
      );
      // oxlint-disable-next-line no-console
      console.error({
        route: path,
        category,
        ...reportMetadata,
        ...describeErrorForLog(error),
        ...details,
      });
      return apiError(status, errorMessage);
    }
  };
}

type RouteErrorCategory =
  | 'config'
  | 'timeout'
  | `github_${GitHubIssueCreationErrorKind}`
  | 'provider'
  | 'token_limit'
  | 'generated_output_limit'
  | 'unknown';

type RouteErrorClassification = {
  category: RouteErrorCategory;
  status: number;
  details: Record<string, unknown>;
};

function classifyRouteError(
  error: unknown,
  unknownErrorStatus: RouteErrorPolicy['unknownErrorStatus'],
): RouteErrorClassification {
  if (error instanceof EnvironmentValidationError) {
    return { category: 'config', status: 500, details: {} };
  }
  if (error instanceof UpstreamTimeoutError) {
    return {
      category: 'timeout',
      status: 504,
      details: {
        upstream: logToken(error.upstream),
        timeoutMs: error.timeoutMs,
      },
    };
  }
  if (error instanceof GitHubIssueCreationError) {
    return {
      category: `github_${error.kind}`,
      status: 502,
      details: { githubStatus: error.status },
    };
  }
  const providerError = RetryError.isInstance(error) ? error.lastError : error;
  if (APICallError.isInstance(providerError)) {
    return {
      category: 'provider',
      status: 502,
      details: {
        providerStatus: providerError.statusCode,
        isRetryable: providerError.isRetryable,
        ...(RetryError.isInstance(error)
          ? {
              attempts: error.errors.length,
              retryReason: logToken(error.reason),
            }
          : {}),
      },
    };
  }
  if (error instanceof SectionTokenLimitError) {
    return {
      category: 'token_limit',
      status: 502,
      details: {
        maxOutputTokens: error.maxOutputTokens,
        outputTokens: error.outputTokens,
      },
    };
  }
  if (error instanceof GeneratedOutputLimitError) {
    return { category: 'generated_output_limit', status: 502, details: {} };
  }
  return { category: 'unknown', status: unknownErrorStatus, details: {} };
}
