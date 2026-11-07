/**
 * Report sanitizing primitives. Reports never store free text: a message or
 * an upstream response body is replaced by a placeholder that shows only its
 * length. What remains is structural and fail-closed: an error
 * class name, the page's route pattern (`routes.ts`), a canonical timestamp
 * and canonical stack frames (`stackFrames.ts`). Runs in the browser before
 * a report is sent and again on the Worker before a report reaches a GitHub
 * issue or Workers Logs.
 */

import { APP_ROUTE_PATTERNS, routeOf } from './routes.ts';
import { truncateText } from './text.ts';

export const REDACTED = '[redacted]';
export const TRUNCATED = '… [truncated]';
/**
 * The one origin every sanitized report URL carries. A real host is never
 * kept (it can name a person or a private network), nor a real path: only
 * the route pattern it matched. The synthetic origin keeps the result a
 * valid URL for the report schemas.
 */
export const REPORT_ORIGIN = 'https://app.invalid';

// Sanitizing reads at most this many times a field's limit, so an oversized
// field costs bounded CPU however large the request body was.
export const SANITIZE_INPUT_FACTOR = 4;

/** The only labels a length placeholder is built with. */
export const OMITTED_FIELDS = ['message', 'text'] as const;
export type OmittedField = (typeof OMITTED_FIELDS)[number];

// The largest length a placeholder shows: a longer text shows this, so the
// number always fits the 4 digits a second pass accepts.
const OMITTED_LENGTH_MAX = 9_999;
// A placeholder this code built, for one of its own labels, with at most a
// 4-digit length: `[message omitted: 142 characters]`.
const OMITTED_TEXT = new RegExp(
  `^\\[(${OMITTED_FIELDS.join('|')}) omitted: (\\d{1,4}) characters\\]$`,
);

/**
 * `[message omitted: 142 characters]`: free text, reduced to its length.
 * A second pass (the Worker, after the browser) keeps the first pass's
 * length: a placeholder with the same label and a length of at most 4
 * digits is parsed and rebuilt from its number, never passed on as given.
 * Anything else, such as a crafted label, is measured as new text. A
 * length past 9,999 shows as 9999.
 */
export function omittedText(field: OmittedField, value: string): string {
  const [, label, length] = OMITTED_TEXT.exec(value) ?? [];
  const count = Math.min(
    label === field ? Number(length) : value.length,
    OMITTED_LENGTH_MAX,
  );
  return `[${field} omitted: ${count} characters]`;
}

/**
 * The error class names a report may keep: JavaScript's and the browser's
 * built-ins, and every class the app or Worker defines or reports. A fixed
 * list, not a shape: a shape such as `…Error` would let `Token_sk_live_…Error`
 * through. Any other name becomes `Error`.
 */
const KNOWN_ERROR_NAMES = new Set([
  // JavaScript
  'AggregateError',
  'Error',
  'EvalError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'TypeError',
  'URIError',
  // The browser
  'AbortError',
  'DOMException',
  'InvalidStateError',
  'NetworkError',
  'NotAllowedError',
  'NotFoundError',
  'QuotaExceededError',
  'SecurityError',
  'TimeoutError',
  // Bundlers
  'ChunkLoadError',
  // The Worker and the AI SDK it reports
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

/** The error name if it is a known error class, else `Error`. */
export function sanitizeErrorName(name: string): string {
  return KNOWN_ERROR_NAMES.has(name) ? name : UNKNOWN_ERROR_NAME;
}

/**
 * A URL as `https://app.invalid` and the app route pattern its path
 * matched (`/summary`), or `/[unknown-route]`: no host, credentials, query,
 * fragment or path segment the browser chose. Always a valid URL.
 */
export function toRouteUrl(value: string): string {
  return `${REPORT_ORIGIN}${routeOf(value, APP_ROUTE_PATTERNS)}`;
}

/**
 * Drops the trailing partial line a hard cut may have left: it could be the
 * front half of a frame that would not have parsed whole.
 */
export function cutAtLastBreak(
  value: string,
  isBreak: (char: string) => boolean,
): string {
  let end = value.length;
  while (end > 0 && !isBreak(value[end - 1] ?? '')) end -= 1;
  return value.slice(0, end);
}

/**
 * Text the caller already cut, marked as cut: it and the visible marker fit
 * in `max` code units, never splitting a surrogate pair.
 */
export function markTruncated(value: string, max: number): string {
  return `${truncateText(value, max - TRUNCATED.length)}${TRUNCATED}`;
}
