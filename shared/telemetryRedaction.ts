/**
 * Report sanitizing for Error telemetry and User reports. Runs in the browser
 * before a report is sent and again on the Worker before a report reaches a
 * GitHub issue or Workers Logs: the Worker never trusts the client.
 *
 * Patterns may only start at a run boundary (a lookbehind) and bound any
 * inner backtracking, so every pass is linear in the input length.
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

// A run of URL-ish characters. Each one is checked once, by stripUrlQuery.
const URL_TOKEN_PATTERN = /[^\s()'"<>`]+/g;
const QUERY_START = /[?#]/;
const STACK_COORDINATE_SUFFIX = /:\d+:\d+$/;

/**
 * Drops the query and fragment of an absolute URL or a root-relative path,
 * keeping a trailing `:line:column` so stack frames stay readable.
 */
function stripUrlQuery(token: string): string {
  const start = token.search(QUERY_START);
  if (start === -1) return token;
  const path = token.slice(0, start);
  if (!path.includes('://') && !path.startsWith('/')) return token;
  return `${path}${STACK_COORDINATE_SUFFIX.exec(token.slice(start))?.[0] ?? ''}`;
}

// `name=value` or `name: value`. The name is checked by isSecretName.
const PAIR_NAME_PATTERN = /(?<![\w-])([\w-]{1,64})(["']?\s*[=:]\s*)/g;
const PAIR_VALUE_PATTERN =
  /"(?:[^"\\\n]|\\.){0,512}"|'(?:[^'\\\n]|\\.){0,512}'|(?:(?:Bearer|Basic)\s+)?(?:\[redacted\]|["']?[^\s&"',;)}\]]+)/y;
const SECRET_NAME_WORDS = new Set([
  'auth',
  'authorization',
  'cookie',
  'cookies',
  'credential',
  'credentials',
  'jwt',
  'key',
  'keys',
  'passwd',
  'password',
  'passwords',
  'pwd',
  'secret',
  'secrets',
  'session',
  'sid',
  'signature',
  'token',
  'tokens',
]);
const SECRET_NAME_COMPOUNDS = new Set([
  'accesskey',
  'accesstoken',
  'apikey',
  'authtoken',
  'clientsecret',
  'idtoken',
  'privatekey',
  'refreshtoken',
  'secretkey',
  'sessionid',
  'sessiontoken',
  'xapikey',
]);
const CAMEL_BOUNDARY = /([a-z0-9])([A-Z])/g;
const NAME_SEPARATORS = /[\s_-]+/;
const SEPARATORS = /[_-]/g;

/** True when a word of the name (camelCase, snake_case or kebab-case) is a credential word. */
function isSecretName(name: string): boolean {
  if (SECRET_NAME_COMPOUNDS.has(name.toLowerCase().replace(SEPARATORS, '')))
    return true;
  return name
    .replace(CAMEL_BOUNDARY, '$1 $2')
    .toLowerCase()
    .split(NAME_SEPARATORS)
    .some((word) => SECRET_NAME_WORDS.has(word));
}

function redactSecretPairs(value: string): string {
  let output = '';
  let cursor = 0;
  for (const match of value.matchAll(PAIR_NAME_PATTERN)) {
    if (match.index < cursor || !isSecretName(match[1] ?? '')) continue;
    const valueStart = match.index + match[0].length;
    PAIR_VALUE_PATTERN.lastIndex = valueStart;
    const secret = PAIR_VALUE_PATTERN.exec(value)?.[0];
    if (!secret) continue;
    const quote = secret[0] === '"' || secret[0] === "'" ? secret[0] : '';
    const closed = quote && secret.length > 1 && secret.endsWith(quote);
    output += `${value.slice(cursor, valueStart)}${quote}${REDACTED}${closed ? quote : ''}`;
    cursor = valueStart + secret.length;
  }
  return cursor === 0 ? value : `${output}${value.slice(cursor)}`;
}

const BEARER_PATTERN = /\b(Bearer)\s+(?!\[redacted\])[\w.~+/=-]+/gi;
const JWT_PATTERN = /(?<![\w-])eyJ[\w-]{2,}\.[\w-]{2,}(?:\.[\w-]+)?/g;
// Well-known API key prefixes too short for the long-token rule.
const PREFIXED_KEY_PATTERN =
  /(?<![\w-])(?:(?:sk|pk|rk)-[\w-]{16,}|(?:gh[pousr]_|github_pat_)\w{20,}|xox[abprs]-[\w-]{10,}|(?:AKIA|ASIA)[A-Z0-9]{16}(?![\w-]))/g;
const EMAIL_PATTERN =
  /(?<![\w.%+-])[\w.%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
// International (+…), North American, trunk-prefixed (0…) and 7-digit local
// numbers. Never starts after `:`, `.`, `/` or `-`, so stack coordinates,
// dates and paths are left alone.
const PHONE_PATTERN =
  /(?<![\w+:./-])(?:\+\d[\d\s().-]{6,}\d|(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}|0\d{2,4}[\s-]?\d{3,4}(?:[\s-]?\d{3,4})?|\d{3}-\d{4})(?![\w-])/g;
// Long runs of letters and digits: hex digests, API keys, base64 secrets.
const LONG_TOKEN_PATTERN = /(?<![\w+/=-])[\w+/-]{32,}={0,2}(?![\w+/=-])/g;
const HAS_DIGIT = /\d/;
const HAS_LETTER = /[A-Za-z]/;

function isRandomToken(value: string) {
  return value.length >= 32 && HAS_DIGIT.test(value) && HAS_LETTER.test(value);
}

/** A `/`-separated run without base64 markers is a path: judge each segment. */
function redactLongToken(match: string): string {
  if (match.includes('/') && !match.includes('+') && !match.endsWith('='))
    return match
      .split('/')
      .map((segment) => (isRandomToken(segment) ? REDACTED : segment))
      .join('/');
  return isRandomToken(match) ? REDACTED : match;
}

/** Masks known sensitive patterns, leaving messages and stack frames readable. */
export function redactTelemetryText(value: string): string {
  return redactSecretPairs(value.replace(URL_TOKEN_PATTERN, stripUrlQuery))
    .replace(BEARER_PATTERN, `$1 ${REDACTED}`)
    .replace(JWT_PATTERN, REDACTED)
    .replace(PREFIXED_KEY_PATTERN, REDACTED)
    .replace(EMAIL_PATTERN, REDACTED)
    .replace(PHONE_PATTERN, REDACTED)
    .replace(LONG_TOKEN_PATTERN, redactLongToken);
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
