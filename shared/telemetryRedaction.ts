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

// An error class name: `TypeError`, `ChunkLoadError`, `DOMException`. No
// digits, so it cannot carry a number, and no other shape.
const ERROR_NAME = /^(?:[A-Z][A-Za-z_]{0,62})?(?:Error|Exception)$/;

/** The error name if it is an error class name, else `[redacted]`. */
export function sanitizeErrorName(name: string): string {
  return ERROR_NAME.test(name) ? name : REDACTED;
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
  /(?:^|[^A-Za-z0-9])[a-z]{2,4}[-_](?:[a-z]{2,8}[-_])?[A-Za-z0-9]{16,}(?![A-Za-z0-9])/;

/**
 * True when a value holds a key-shaped token. The one check shared by URL
 * path segments and stack-frame function names, so they cannot drift.
 */
export function isSensitiveToken(value: string): boolean {
  return KEY_SHAPE.test(value);
}
// A word with this share of upper-case letters, past this length, looks
// random rather than written (`AbCdEfGh…`, `XkfQpLmZrAb`); `UserProfile`,
// `getElementById` and `XMLHttpRequest` stay. All-capitals is a word too.
const MIXED_CASE_MIN_LENGTH = 8;
const MAX_UPPER_SHARE = 0.4;
const UPPER = /[A-Z]/g;

function looksRandom(word: string): boolean {
  if (word.length < MIXED_CASE_MIN_LENGTH || word === word.toUpperCase())
    return false;
  return (word.match(UPPER)?.length ?? 0) / word.length > MAX_UPPER_SHARE;
}

function isSafeSegmentPart(part: string): boolean {
  return (
    (SEGMENT_WORD.test(part) && !looksRandom(part)) ||
    SEGMENT_NUMBER.test(part) ||
    VERSION.test(part)
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
      isSafeSegmentPart(part) || (isFileName && CONTENT_HASH.test(part)),
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
