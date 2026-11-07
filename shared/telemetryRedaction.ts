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

const QUERY_START = /[?#]/;
// `user:password@` at the start of a schemeless authority.
const SCHEMELESS_USERINFO = /^[^\s/@:?#]+:[^\s/@?#]*@(?=[^\s/@])/;

/**
 * Drops `user:password@` from a URL or URL-like token: after `scheme://`,
 * after a leading `//`, or at the start of a schemeless `user:pass@host`.
 */
function stripUserinfo(token: string): string {
  const scheme = token.indexOf('://');
  if (scheme === -1 && !token.startsWith('//'))
    return token.replace(SCHEMELESS_USERINFO, '');
  const authorityStart = scheme === -1 ? 2 : scheme + 3;
  let authorityEnd = authorityStart;
  while (
    authorityEnd < token.length &&
    !'/?#'.includes(token[authorityEnd] ?? '')
  )
    authorityEnd += 1;
  const at = token.lastIndexOf('@', authorityEnd - 1);
  return at < authorityStart
    ? token
    : `${token.slice(0, authorityStart)}${token.slice(at + 1)}`;
}

/** Reduces a URL to origin + path: no credentials, query string or fragment. */
export function toPathOnlyUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.origin !== 'null') return `${url.origin}${url.pathname}`;
  } catch {
    // Not an absolute URL: fall through to the token rules below.
  }
  const withoutUserinfo = stripUserinfo(value);
  const end = withoutUserinfo.search(QUERY_START);
  return end === -1 ? withoutUserinfo : withoutUserinfo.slice(0, end);
}

// A run of URL-ish characters. Each one is checked once, by reduceUrlToken.
const URL_TOKEN_PATTERN = /[^\s()'"<>`]+/g;
const STACK_COORDINATE_SUFFIX = /:\d+:\d+$/;
// A path part with a `/` or a `.` looks like a URL, a path or a file name.
const URL_LIKE_PATH = /[/.]/;

/**
 * Drops the userinfo, query and fragment of anything URL-like (absolute,
 * relative or schemeless), keeping a trailing `:line:column` so stack frames
 * stay readable. Prose such as `What?` or `issue #12` has no path part.
 */
function reduceUrlToken(value: string): string {
  const token = stripUserinfo(value);
  const start = token.search(QUERY_START);
  if (start === -1) return token;
  const path = token.slice(0, start);
  const rest = token.slice(start);
  if (!path || rest.length < 2 || !URL_LIKE_PATH.test(path)) return token;
  return `${path}${STACK_COORDINATE_SUFFIX.exec(rest)?.[0] ?? ''}`;
}

// `name=value`, `name: value`, or `multi-word-name value` (a header written
// with a space). The name is judged by isSecretName.
const PAIR_NAME_PATTERN = /(?<![\w-])([\w-]{1,64})(["']?\s*[=:]\s*|[ \t]+)/g;
const PAIR_SEPARATOR = /[=:]/;
const STACK_FRAME_VALUE = /^[([]/;
// A quoted value is consumed whole, however long and even if unterminated.
const PAIR_VALUE_PATTERN =
  /"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?|(?:(?:Bearer|Basic)\s+)?(?:\[redacted\]|[^\s&"',;)}\]]+)/y;
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
  'otp',
  'passcode',
  'passphrase',
  'passwd',
  'password',
  'passwords',
  'pin',
  'pwd',
  'secret',
  'secrets',
  'session',
  'sid',
  'signature',
  'token',
  'tokens',
  'totp',
]);
// `code` alone is ordinary (`error code: E42`); with one of these it is a secret.
const SECRET_CODE_QUALIFIERS = new Set([
  'access',
  'confirmation',
  'login',
  'mfa',
  'recovery',
  'reset',
  'security',
  'sms',
  'verification',
  'verify',
]);
const SECRET_NAME_COMPOUNDS = new Set([
  'accesskey',
  'accesstoken',
  'apikey',
  'apitoken',
  'authcode',
  'authtoken',
  'clientsecret',
  'idtoken',
  'mfacode',
  'otpcode',
  'privatekey',
  'recoverycode',
  'refreshtoken',
  'resetcode',
  'secretkey',
  'securitycode',
  'sessionid',
  'sessiontoken',
  'verificationcode',
  'xapikey',
]);
const CAMEL_BOUNDARY = /([a-z0-9])([A-Z])/g;
const NAME_SEPARATORS = /[\s_-]+/;

/** The words of a camelCase, snake_case or kebab-case name, lower-cased. */
function nameWords(name: string): string[] {
  return name
    .replace(CAMEL_BOUNDARY, '$1 $2')
    .toLowerCase()
    .split(NAME_SEPARATORS)
    .filter(Boolean);
}

/** True when the name, or a word of it, is a credential word. */
function isSecretName(words: string[]): boolean {
  if (SECRET_NAME_COMPOUNDS.has(words.join(''))) return true;
  if (words.some((word) => SECRET_NAME_WORDS.has(word))) return true;
  return (
    words.includes('code') &&
    words.some((word) => SECRET_CODE_QUALIFIERS.has(word))
  );
}

function redactSecretPairs(value: string): string {
  let output = '';
  let cursor = 0;
  for (const match of value.matchAll(PAIR_NAME_PATTERN)) {
    if (match.index < cursor) continue;
    const words = nameWords(match[1] ?? '');
    // Only a multi-word name may use a bare space (`x-api-key abc`), so prose
    // such as `the key is missing` stays readable.
    const spaced = !PAIR_SEPARATOR.test(match[2] ?? '');
    if ((spaced && words.length < 2) || !isSecretName(words)) continue;
    const valueStart = match.index + match[0].length;
    PAIR_VALUE_PATTERN.lastIndex = valueStart;
    const secret = PAIR_VALUE_PATTERN.exec(value)?.[0];
    // `at fetchWithAuth (url)` and `refreshToken [as x]` are stack frames.
    if (!secret || (spaced && STACK_FRAME_VALUE.test(secret))) continue;
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
  return redactSecretPairs(value.replace(URL_TOKEN_PATTERN, reduceUrlToken))
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
 * marker. Redaction runs before the final cut, so a secret straddling `max`
 * is still recognized. Pass `inputWasCut` when the caller already cut the
 * value (a bounded read): its trailing partial token is dropped outright,
 * since it may be the front half of a secret no pattern recognizes.
 */
export function sanitizeTelemetryText(
  value: string,
  max: number,
  { inputWasCut = false }: { inputWasCut?: boolean } = {},
): string {
  const bound = max * REDACTION_INPUT_FACTOR;
  const cut = inputWasCut || value.length > bound;
  const redacted = redactTelemetryText(
    cut
      ? cutAtLastWhitespace(value.slice(0, bound), inputWasCut ? 0 : max)
      : value,
  );
  return cut || redacted.length > max
    ? `${redacted.slice(0, max)}${TRUNCATED}`
    : redacted;
}
