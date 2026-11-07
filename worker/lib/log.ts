import {
  sanitizeReportTimestamp,
  sanitizeReportUrl,
} from '../../shared/errorReporting.ts';
import { sanitizeStackTrace } from '../../shared/stackFrames.ts';
import {
  omittedText,
  sanitizeErrorName,
} from '../../shared/telemetryRedaction.ts';

// A logged stack is shorter than a stored one: Workers Logs lines stay small.
const LOG_STACK_MAX = 4_000;
// A machine token such as an upstream (`github`) or a retry reason
// (`maxRetriesExceeded`): letters and `_` only.
const LOG_TOKEN = /^[A-Za-z][A-Za-z_]{0,63}$/;

/**
 * A string bound for Workers Logs: kept only as a short machine token,
 * else reduced to its length. Other values pass through.
 */
export function logToken(value: unknown) {
  if (typeof value !== 'string') return value;
  return LOG_TOKEN.test(value) ? value : omittedText('text', value);
}

/** Reduces a URL bound for Workers Logs to origin + plain path. */
export function redactUrlForLog(value: unknown) {
  return typeof value === 'string' ? sanitizeReportUrl(value) : value;
}

/** A report timestamp bound for Workers Logs, as a bounded canonical value. */
export function timestampForLog(value: unknown) {
  return typeof value === 'string' ? sanitizeReportTimestamp(value) : value;
}

/**
 * What a log line may carry about a thrown value: its error class name,
 * canonical stack frames, its cause's class name, and its message reduced to
 * a length. No message text is ever logged.
 */
export function describeErrorForLog(error: unknown) {
  if (!(error instanceof Error))
    return { message: omittedText('thrown value', String(error)) };
  return {
    name: sanitizeErrorName(error.name),
    stack:
      error.stack === undefined
        ? undefined
        : sanitizeStackTrace(error.stack, LOG_STACK_MAX),
    causeName:
      error.cause instanceof Error
        ? sanitizeErrorName(error.cause.name)
        : undefined,
    message: omittedText('message', error.message),
  };
}
