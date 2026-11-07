import { APICallError } from 'ai';
import type { Middleware } from 'remix/router';
import { isClientAbort } from '../lib/abort.ts';
import { UpstreamTimeoutError } from '../lib/deadline.ts';
import { EnvironmentValidationError } from '../lib/environment.ts';
import { apiError } from '../lib/response.ts';
import { SectionTokenLimitError } from '../services/ai.ts';
import {
  GitHubIssueCreationError,
  type GitHubIssueCreationErrorKind,
} from '../services/github.ts';
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
      const { category, status, details } = classifyRouteError(
        error,
        generation,
      );
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
        ...details,
      });
      return apiError(status, errorMessage);
    }
  };
}

/** The `category` a route failure is logged under, for counting. */
type RouteErrorCategory =
  | 'config'
  | 'timeout'
  | `github_${GitHubIssueCreationErrorKind}`
  | 'provider'
  | 'token_limit'
  | 'unknown';

type RouteErrorClassification = {
  category: RouteErrorCategory;
  status: number;
  details: Record<string, unknown>;
};

/**
 * Maps a route failure to its log category, response status and the fields
 * logged with it. Upstream failures are 502, a deadline is 504, a missing
 * variable is 500; an unrecognized error is 500 on a generation route and 502
 * on a reporting route, whose only work is the GitHub call.
 */
function classifyRouteError(
  error: unknown,
  generation: boolean,
): RouteErrorClassification {
  if (error instanceof EnvironmentValidationError) {
    return { category: 'config', status: 500, details: {} };
  }
  if (error instanceof UpstreamTimeoutError) {
    return {
      category: 'timeout',
      status: 504,
      details: { upstream: error.upstream, timeoutMs: error.timeoutMs },
    };
  }
  if (error instanceof GitHubIssueCreationError) {
    return {
      category: `github_${error.kind}`,
      status: 502,
      details: {
        githubStatus: error.status,
        githubResponseSnippet: error.details,
      },
    };
  }
  if (APICallError.isInstance(error)) {
    return {
      category: 'provider',
      status: 502,
      details: {
        providerStatus: error.statusCode,
        providerUrl: error.url,
        isRetryable: error.isRetryable,
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
  return { category: 'unknown', status: generation ? 500 : 502, details: {} };
}
