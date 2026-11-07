/**
 * Redaction for error telemetry and user reports. Runs on the client before a
 * report is sent and again on the Worker before a report reaches a GitHub
 * issue or Workers Logs: the Worker never trusts the client to have done it.
 *
 * Every pattern is anchored by a lookbehind so a match can only start at a
 * run boundary. That keeps each pass linear in the input length.
 */

export const REDACTED = '[redacted]';
export const TRUNCATED = '… [truncated]';

// Redaction reads at most this many times a field's limit, so an oversized
// field costs bounded CPU however large the request body was.
const REDACTION_INPUT_FACTOR = 4;
const WHITESPACE = /\s/;

/** Reduces a URL to origin + path: no credentials, query string or fragment. */
export function toPathOnlyUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.origin !== 'null') return `${url.origin}${url.pathname}`;
  } catch {
    // Not an absolute URL: fall through and cut at the first ? or #.
  }
  const end = value.search(/[?#]/);
  return end === -1 ? value : value.slice(0, end);
}

// The query and fragment of an http(s) URL inside free text. A trailing
// `:line:column` stack coordinate is kept so stack frames stay readable.
const URL_QUERY_PATTERN =
  /(\bhttps?:\/\/[^\s?#()'"<>]*)[?#][^\s()'"<>]*?(?=(?::\d+:\d+)?(?:[\s()'"<>]|$))/g;
// `name=value` or `name: value` where the name looks like a credential.
const SECRET_PAIR_PATTERN =
  /(?<![\w-])([\w-]*(?:token|key|secret|passw(?:or)?d|pwd|auth|session|cookie|credential|signature)[\w-]*)(["']?\s*[=:]\s*["']?)(?:(?:Bearer|Basic)\s+)?(?:\[redacted\]|[^\s&"',;)}\]]+)/gi;
const BEARER_PATTERN = /\b(Bearer)\s+(?!\[redacted\])[\w.~+/=-]+/gi;
const EMAIL_PATTERN =
  /(?<![\w.%+-])[\w.%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
// International numbers written with a leading +, and North American numbers.
const PHONE_PATTERN =
  /(?<![\w+])(?:\+\d[\d\s().-]{6,}\d|(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4})(?!\w)/g;
// Long runs of letters and digits: hex digests, API keys, base64url secrets.
const LONG_TOKEN_PATTERN = /(?<![\w-])[\w-]{32,}={0,2}(?![\w-])/g;
const HAS_DIGIT = /\d/;
const HAS_LETTER = /[A-Za-z]/;

/** Masks known sensitive patterns, leaving messages and stack frames readable. */
export function redactTelemetryText(value: string): string {
  return value
    .replace(URL_QUERY_PATTERN, '$1')
    .replace(
      SECRET_PAIR_PATTERN,
      (_match, name: string, separator: string) =>
        `${name}${separator}${REDACTED}`,
    )
    .replace(BEARER_PATTERN, `$1 ${REDACTED}`)
    .replace(EMAIL_PATTERN, REDACTED)
    .replace(PHONE_PATTERN, REDACTED)
    .replace(LONG_TOKEN_PATTERN, (match) =>
      HAS_DIGIT.test(match) && HAS_LETTER.test(match) ? REDACTED : match,
    );
}

/**
 * Drops the trailing partial word a hard cut may have left: it could be the
 * front half of a secret no pattern recognizes any more. Never cuts below
 * `floor`, so one huge word still leaves something to read.
 */
function cutAtLastWhitespace(value: string, floor: number): string {
  let end = value.length;
  while (end > floor && !WHITESPACE.test(value[end - 1] ?? '')) end -= 1;
  return value.slice(0, end);
}

/**
 * Redacts a field, then truncates it to `max` characters with a visible
 * marker. Safe to apply twice: the Worker re-runs it on what the client sent.
 */
export function sanitizeTelemetryText(value: string, max: number): string {
  const bound = max * REDACTION_INPUT_FACTOR;
  const bounded = value.length > bound;
  const redacted = redactTelemetryText(
    bounded ? cutAtLastWhitespace(value.slice(0, bound), max) : value,
  );
  return bounded || redacted.length > max
    ? `${redacted.slice(0, max)}${TRUNCATED}`
    : redacted;
}
