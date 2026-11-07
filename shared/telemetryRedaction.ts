/**
 * Report sanitizing primitives. Reports never store free text: a message or
 * an upstream response body is replaced by a placeholder that shows only its
 * length. What remains is structural and fail-closed: an error
 * class name, a path-only URL, a canonical timestamp and canonical stack
 * frames (`stackFrames.ts`). Runs in the browser before a report is sent and
 * again on the Worker before a report reaches a GitHub issue or Workers Logs.
 */

import { truncateText } from './text.ts';

export const REDACTED = '[redacted]';
export const TRUNCATED = '… [truncated]';
/**
 * The one origin every sanitized report URL carries. A real host is never
 * kept (it can name a person or a private network); only the path is. The
 * synthetic origin keeps the result a valid URL for the report schemas.
 */
export const REPORT_ORIGIN = 'https://app.invalid';

// Sanitizing reads at most this many times a field's limit, so an oversized
// field costs bounded CPU however large the request body was.
export const SANITIZE_INPUT_FACTOR = 4;

/** `[message omitted: 142 characters]`: free text, reduced to its length. */
export function omittedText(field: string, value: string): string {
  return `[${field} omitted: ${value.length} characters]`;
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

// A URL path segment: its characters, then its parts split at `-_.~+`. Each
// part is a word, a short number or an API version; a file name with an
// extension may also hold a content hash (`index-C4kL9x.js`).
const SEGMENT_CHARACTERS = /^@?[\w.~+()[\]-]{1,64}$/;
const SEGMENT_PART_SEPARATORS = /[-_.~+]+/;
const SEGMENT_WRAPPERS = /[()[\]]/g;
const SEGMENT_WORD = /^[A-Za-z]{1,24}$/;
const SEGMENT_NUMBER = /^\d{1,4}$/;
const VERSION = /^v\d{1,3}$/i;
const FILE_EXTENSION = /\.[A-Za-z]{1,5}$/;
const CONTENT_HASH = /^[A-Za-z0-9]{4,16}$/;
// A key shape anywhere in a value: a short lower-case prefix, an optional
// short tag, then 16+ letters or digits (`sk_live_…`, `pk_test_…`, `ghp_…`,
// `xoxb-…`), bounded by anything that is not a letter or digit. So wrappers,
// a sigil, a file extension, a dotted part or an alias cannot hide it. One
// structural rule rather than a list of prefixes.
const KEY_SHAPE =
  /(?:^|[^A-Za-z0-9])[a-z]{2,4}[-_](?:[a-z]{2,8}[-_])?[a-z0-9]{16,}(?![a-z0-9])/i;

/**
 * True when a value holds a key-shaped token. The one check shared by URL
 * path segments and stack-frame function names, so they cannot drift.
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
    (SEGMENT_WORD.test(word) && !looksRandom(word)) ||
    SEGMENT_NUMBER.test(word) ||
    VERSION.test(word)
  );
}

/**
 * The one rule a URL path segment's parts and a stack frame's function-name
 * parts both pass: at most 4 digits, no key shape (any case), and every
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
 * A plain path segment (`api`, `v1`, `users`, `1234`, `index-C4kL9x.js`,
 * `@scope`, `(group)`, `[slug]`) with at most 4 digits in total. It is
 * judged whole as well as by its parts: a random-looking token such as
 * `XkfQpLmZr9Ab`, or one holding a key (`sk_live_…`, `(sk_live_…)`,
 * `sk_live_….js`), is not.
 */
function isSafeSegment(segment: string): boolean {
  if (
    !SEGMENT_CHARACTERS.test(segment) ||
    hasTooManyDigits(segment) ||
    isSensitiveToken(segment)
  )
    return false;
  const bare = segment.replace(/^@/, '').replace(SEGMENT_WRAPPERS, '');
  const parts = bare.split(SEGMENT_PART_SEPARATORS).filter(Boolean);
  const isFileName = FILE_EXTENSION.test(bare);
  return parts.every(
    (part) =>
      isSafeIdentifierPart(part) || (isFileName && CONTENT_HASH.test(part)),
  );
}

/** Keeps a path's plain segments; any other segment becomes `[redacted]`. */
export function sanitizePathSegments(path: string, separator: RegExp): string {
  return path
    .split(separator)
    .map((segment) =>
      segment === '' || isSafeSegment(segment) ? segment : REDACTED,
    )
    .join('/');
}

/**
 * An http(s) URL's path, under the synthetic `https://app.invalid` origin:
 * no host, credentials, query string or fragment, and only plain path
 * segments. Anything else is the origin alone. Always a valid URL.
 */
export function toPathOnlyUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return `${REPORT_ORIGIN}/`;
  }
  const http = url.protocol === 'http:' || url.protocol === 'https:';
  if (!http) return `${REPORT_ORIGIN}/`;
  return `${REPORT_ORIGIN}${sanitizePathSegments(url.pathname, /\//)}`;
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
