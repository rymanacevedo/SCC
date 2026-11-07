import {
  sanitizeReportTimestamp,
  sanitizeReportUrl,
} from '../../shared/errorReporting.ts';
import {
  sanitizeStackTrace,
  stackWithHeader,
} from '../../shared/stackFrames.ts';
import {
  type OmittedField,
  omittedText,
  sanitizeErrorName,
  toPathOnlyUrl,
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

/** A request's path bound for Workers Logs, with only plain segments. */
export function pathForLog(url: string): string {
  return new URL(toPathOnlyUrl(url)).pathname;
}

/** A report timestamp bound for Workers Logs, as a bounded canonical value. */
export function timestampForLog(value: unknown) {
  return typeof value === 'string' ? sanitizeReportTimestamp(value) : value;
}

/** `null`, `array` or the `typeof` of a thrown value; never its contents. */
function thrownType(value: unknown): string {
  if (value === null) return 'null';
  return Array.isArray(value) ? 'array' : typeof value;
}

/** A string property's length placeholder; any other value, its type. */
function omittedProperty(field: OmittedField, value: unknown): string {
  return typeof value === 'string'
    ? omittedText(field, value)
    : `[${field} omitted: ${thrownType(value)}]`;
}

/**
 * What a log line may carry about a thrown value: its error class name,
 * canonical stack frames, its cause's class name, and its message reduced to
 * a length. No message text is ever logged, and nothing is stringified: a
 * thrown value that is not an Error is logged by its type alone, since
 * `String(value)` can throw (a null prototype, a throwing `toString` or
 * `Symbol.toPrimitive`). A getter that throws yields a fixed placeholder.
 */
export function describeErrorForLog(error: unknown) {
  try {
    if (!(error instanceof Error))
      return { message: `[thrown ${thrownType(error)} omitted]` };
    const { name, stack, cause, message } = error;
    return {
      name: sanitizeErrorName(typeof name === 'string' ? name : ''),
      stack:
        typeof stack === 'string' && typeof name === 'string'
          ? sanitizeStackTrace(stackWithHeader(name, stack), LOG_STACK_MAX)
          : undefined,
      causeName:
        cause instanceof Error && typeof cause.name === 'string'
          ? sanitizeErrorName(cause.name)
          : undefined,
      message: omittedProperty('message', message),
    };
  } catch {
    return { message: '[error unreadable]' };
  }
}
