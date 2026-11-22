import {
  sanitizeReportTimestamp,
  sanitizeReportUrl,
} from '../../shared/errorReporting.ts';
import { NO_ASSETS } from '../../shared/reportAssets.ts';
import { API_ROUTE_PATTERNS, routeOf } from '../../shared/routes.ts';
import {
  sanitizeStackTrace,
  stackWithHeader,
} from '../../shared/stackFrames.ts';
import {
  type OmittedField,
  omittedText,
  sanitizeErrorName,
} from '../../shared/telemetryRedaction.ts';

const LOG_STACK_MAX = 4_000;
const LOG_TOKEN = /^[A-Za-z][A-Za-z_]{0,63}$/;

export function logToken(value: unknown) {
  if (typeof value !== 'string') return value;
  return LOG_TOKEN.test(value) ? value : omittedText('text', value);
}

export function redactUrlForLog(value: unknown) {
  return typeof value === 'string' ? sanitizeReportUrl(value) : value;
}

export function pathForLog(url: string): string {
  return routeOf(url, API_ROUTE_PATTERNS);
}

export function timestampForLog(value: unknown) {
  return typeof value === 'string' ? sanitizeReportTimestamp(value) : value;
}

function thrownType(value: unknown): string {
  if (value === null) return 'null';
  return Array.isArray(value) ? 'array' : typeof value;
}

function omittedProperty(field: OmittedField, value: unknown): string {
  return typeof value === 'string'
    ? omittedText(field, value)
    : `[${field} omitted: ${thrownType(value)}]`;
}

export function describeErrorForLog(error: unknown) {
  try {
    if (!(error instanceof Error))
      return { message: `[thrown ${thrownType(error)} omitted]` };
    const { name, stack, cause, message } = error;
    return {
      name: sanitizeErrorName(typeof name === 'string' ? name : ''),
      stack:
        typeof stack === 'string' && typeof name === 'string'
          ? sanitizeStackTrace(stackWithHeader(name, stack), LOG_STACK_MAX, {
              knownAssets: NO_ASSETS,
            })
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
