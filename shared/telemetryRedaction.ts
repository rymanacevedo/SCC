import { APP_ROUTE_PATTERNS, routeOf } from './routes.ts';
import { truncateText } from './text.ts';

export const REDACTED = '[redacted]';
export const TRUNCATED = '… [truncated]';
export const REPORT_ORIGIN = 'https://app.invalid';

export const SANITIZE_INPUT_FACTOR = 4;

export const OMITTED_FIELDS = ['message', 'text'] as const;
export type OmittedField = (typeof OMITTED_FIELDS)[number];

const OMITTED_LENGTH_MAX = 9_999;
const OMITTED_TEXT = new RegExp(
  `^\\[(${OMITTED_FIELDS.join('|')}) omitted: (\\d{1,4}) characters\\]$`,
);

export function omittedText(field: OmittedField, value: string): string {
  const [, label, length] = OMITTED_TEXT.exec(value) ?? [];
  const count = Math.min(
    label === field ? Number(length) : value.length,
    OMITTED_LENGTH_MAX,
  );
  return `[${field} omitted: ${count} characters]`;
}

const KNOWN_ERROR_NAMES = new Set([
  'AggregateError',
  'Error',
  'EvalError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'TypeError',
  'URIError',
  'AbortError',
  'DOMException',
  'InvalidStateError',
  'NetworkError',
  'NotAllowedError',
  'NotFoundError',
  'QuotaExceededError',
  'SecurityError',
  'TimeoutError',
  'ChunkLoadError',
  'AI_APICallError',
  'AI_NoObjectGeneratedError',
  'AI_RetryError',
  'EnvironmentValidationError',
  'GeneratedOutputLimitError',
  'GitHubIssueCreationError',
  'SectionTokenLimitError',
  'UpstreamTimeoutError',
]);
const UNKNOWN_ERROR_NAME = 'Error';

export function sanitizeErrorName(name: string): string {
  return KNOWN_ERROR_NAMES.has(name) ? name : UNKNOWN_ERROR_NAME;
}

export function toRouteUrl(value: string): string {
  return `${REPORT_ORIGIN}${routeOf(value, APP_ROUTE_PATTERNS)}`;
}

export function cutAtLastBreak(
  value: string,
  isBreak: (char: string) => boolean,
): string {
  let end = value.length;
  while (end > 0 && !isBreak(value[end - 1] ?? '')) end -= 1;
  return value.slice(0, end);
}

export function markTruncated(value: string, max: number): string {
  return `${truncateText(value, max - TRUNCATED.length)}${TRUNCATED}`;
}
