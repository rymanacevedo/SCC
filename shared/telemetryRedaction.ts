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

// Five digits, however separated, may be a phone number or an id:
// `555-123-4567`, `555.123.4567`, `1a2b3c4d5e`.
const DIGIT = /\d/g;
const MAX_DIGITS = 4;

/** True when `value` holds more digits in total than a short number may. */
export function hasTooManyDigits(value: string): boolean {
  return (value.match(DIGIT)?.length ?? 0) > MAX_DIGITS;
}

// The words an identifier part is made of: a written word, a short number
// or an API version (`v1`).
const WORD = /^[A-Za-z]{1,24}$/;
const NUMBER = /^\d{1,4}$/;
const VERSION = /^v\d{1,3}$/i;
// A key shape anywhere in a value: a short lower-case prefix, an optional
// short tag, then 16+ letters or digits (`sk_live_…`, `pk_test_…`, `ghp_…`,
// `xoxb-…`), bounded by anything that is not a letter or digit. So wrappers,
// a sigil, a file extension, a dotted part or an alias cannot hide it. One
// structural rule rather than a list of prefixes.
const KEY_SHAPE =
  /(?:^|[^A-Za-z0-9])[a-z]{2,4}[-_](?:[a-z]{2,8}[-_])?[a-z0-9]{16,}(?![a-z0-9])/i;

/**
 * True when a value holds a key-shaped token. The one check shared by
 * stack-frame function names and bundle asset names, so they cannot drift.
 */
export function isSensitiveToken(value: string): boolean {
  return KEY_SHAPE.test(value);
}
// A word with this share of upper-case letters, past this length, looks
// random rather than written (`AbCdEfGh…`, `XkfQpLmZrAb`); `UserProfile`,
// `getElementById` and `XMLHttpRequest` stay. All-capitals is a word
// (`README`, `MAX`) up to a length a constant's part plausibly has.
const MIXED_CASE_MIN_LENGTH = 8;
const MAX_UPPER_SHARE = 0.4;
const ALL_CAPS_MAX_LENGTH = 12;
const UPPER = /[A-Z]/g;
// What splits an identifier part into words: `MAX_RETRY_COUNT`, `$foo`.
const IDENTIFIER_WORD_SEPARATORS = /[_$-]+/;

function looksRandom(word: string): boolean {
  if (word.length < MIXED_CASE_MIN_LENGTH) return false;
  if (word === word.toUpperCase()) return word.length > ALL_CAPS_MAX_LENGTH;
  return (word.match(UPPER)?.length ?? 0) / word.length > MAX_UPPER_SHARE;
}

function isSafeWord(word: string): boolean {
  return (
    (WORD.test(word) && !looksRandom(word)) ||
    NUMBER.test(word) ||
    VERSION.test(word)
  );
}

/**
 * The one rule a stack frame's function-name parts and a bundle asset's
 * name parts both pass: at most 4 digits, no key shape (any case), and every
 * word (split at `_`, `$`, `-`) a written word, a short number or an API
 * version. A random-looking word (`XkfQpLmZr9Ab`), a key (`sk_live_…`,
 * an access-key-style `AKIA…`) or a word mixing letters and digits (`hunter2`)
 * fails.
 */
export function isSafeIdentifierPart(part: string): boolean {
  return (
    !hasTooManyDigits(part) &&
    !isSensitiveToken(part) &&
    part.split(IDENTIFIER_WORD_SEPARATORS).filter(Boolean).every(isSafeWord)
  );
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
 * Cuts sanitized text so it and the visible marker fit in `max` code units,
 * never splitting a surrogate pair. `force` marks text the caller already cut.
 */
export function truncateWithMarker(
  value: string,
  max: number,
  force = false,
): string {
  if (!force && value.length <= max) return value;
  return `${truncateText(value, max - TRUNCATED.length)}${TRUNCATED}`;
}
