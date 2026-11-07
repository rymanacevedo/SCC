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
      const { category, status, details } = classifyRouteError(
        error,
        generation,
      );
      // oxlint-disable-next-line no-console -- Categorized failures belong in Workers Logs.
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

/** The `category` a route failure is logged under, for counting. */
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

/**
 * Maps a route failure to its log category, response status and the fields
 * logged with it. No free text is logged: strings are machine tokens
 * (`logToken`) or path-only URLs (`redactUrlForLog`). Upstream
 * failures are 502, a deadline is 504, a missing variable is 500; an
 * unrecognized error is 500 on a generation route and 502 on a reporting
 * route, whose only work is the GitHub call.
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
  // Once the retry budget is spent the SDK wraps the provider's failures in a
  // RetryError; classify the last one, so a 429 that outlasts the retry still
  // counts as a provider failure with its status.
  const providerError = RetryError.isInstance(error) ? error.lastError : error;
  if (APICallError.isInstance(providerError)) {
    return {
      category: 'provider',
      status: 502,
      details: {
        providerStatus: providerError.statusCode,
        providerUrl: redactUrlForLog(providerError.url),
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
  // The model answered, but with more than a section can hold: a bad upstream result.
  if (error instanceof GeneratedOutputLimitError) {
    return { category: 'generated_output_limit', status: 502, details: {} };
  }
  return { category: 'unknown', status: generation ? 500 : 502, details: {} };
}
