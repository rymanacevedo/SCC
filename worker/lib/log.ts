import {
  REPORT_FIELD_MAX,
  sanitizeReportUrl,
} from '../../shared/errorReporting.ts';
import { sanitizeTelemetryText } from '../../shared/telemetryRedaction.ts';

// A logged stack is shorter than a stored one: Workers Logs lines stay small.
const LOG_STACK_MAX = 4_000;

/** Redacts and truncates text bound for Workers Logs; other values pass through. */
export function redactForLog(
  value: unknown,
  max: number = REPORT_FIELD_MAX.message,
) {
  return typeof value === 'string' ? sanitizeTelemetryText(value, max) : value;
}

/** Reduces a URL bound for Workers Logs to origin + path, redacted. */
export function redactUrlForLog(value: unknown) {
  return typeof value === 'string' ? sanitizeReportUrl(value) : value;
}

/** The redacted, truncated parts of a thrown value that a log line may carry. */
export function describeErrorForLog(error: unknown) {
  if (!(error instanceof Error))
    return { message: redactForLog(String(error)) };
  return {
    name: redactForLog(error.name),
    stack: redactForLog(error.stack, LOG_STACK_MAX),
    causeMessage:
      error.cause instanceof Error
        ? redactForLog(error.cause.message)
        : undefined,
    message: redactForLog(error.message),
  };
}
