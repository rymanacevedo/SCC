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
const HAS_DIGIT = /\d/;
const HAS_LETTER = /[A-Za-z]/;
const LOWER = /[a-z]/;
const UPPER = /[A-Z]/;

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

// A whitespace-free run of text, and where a URL starts inside it: at a
// scheme (`https://`, anchored so a scan starts only at a run boundary), else
// after any leading wrapper openers (root-relative and schemeless paths).
const NON_WHITESPACE_RUN = /\S+/g;
const SCHEME_START = /(?<![a-z0-9+.-])[a-z][a-z0-9+.-]*:\/\//i;
const LEADING_OPENERS = /^[([{<"'`]*/;
const STACK_COORDINATE_SUFFIX = /:\d+:\d+$/;
// A path part with a `/` or a `.` looks like a URL, a path or a file name.
const URL_LIKE_PATH = /[/.]/;
// The delimiter that closes a URL opened by the character before it.
const CLOSERS: Record<string, string> = {
  '(': ')',
  '[': ']',
  '<': '>',
  '{': '}',
  '"': '"',
  "'": "'",
  '`': '`',
};

/**
 * Where a query starting at `start` ends inside `run`: the end of the run,
 * or the delimiter matching `opener` (the character before the URL),
 * counting nested brackets, so `(https://x/a.js?v=(1):10:5)` ends at the
 * frame's `)`.
 */
function queryEnd(run: string, start: number, opener: string): number {
  const closer = CLOSERS[opener];
  const nests = closer !== undefined && closer !== opener;
  let depth = 1;
  let end = start;
  for (; end < run.length; end += 1) {
    const char = run[end];
    if (nests && char === opener) depth += 1;
    else if (char === closer && (depth -= 1) === 0) break;
  }
  return end;
}

/**
 * Drops the userinfo, query and fragment of one whitespace-free run if it
 * holds anything URL-like (absolute, relative or schemeless). The path keeps
 * every legal character, parens and brackets included; only the query is
 * trimmed back to a closer matching an opener before the URL. A trailing
 * `:line:column` is kept so stack frames stay readable. Prose such as
 * `What?` or `issue #12` has no path part.
 */
function reduceUrlRun(run: string): string {
  const scheme = run.search(SCHEME_START);
  const urlStart =
    scheme === -1 ? (LEADING_OPENERS.exec(run)?.[0].length ?? 0) : scheme;
  const prefix = run.slice(0, urlStart);
  const url = run.slice(urlStart);
  const queryOffset = url.search(QUERY_START);
  const path = url.slice(0, Math.max(queryOffset, 0));
  if (queryOffset === -1 || !path || !URL_LIKE_PATH.test(path))
    return `${prefix}${stripUserinfo(url)}`;
  const end = queryEnd(url, queryOffset, prefix.at(-1) ?? '');
  const query = url.slice(queryOffset, end);
  if (query.length < 2) return `${prefix}${stripUserinfo(url)}`;
  const coordinate = STACK_COORDINATE_SUFFIX.exec(query)?.[0] ?? '';
  return `${prefix}${stripUserinfo(path)}${coordinate}${url.slice(end)}`;
}

/** Applies reduceUrlRun to every whitespace-free run; linear in the input. */
function stripUrlQueries(text: string): string {
  return text.replace(NON_WHITESPACE_RUN, reduceUrlRun);
}

// `name=value`, `name: value`, or `name value` (a header written with a
// space). The name is judged by isSecretName.
const PAIR_NAME_PATTERN = /(?<![\w-])([\w-]{1,64})(["']?\s*[=:]\s*|[ \t]+)/g;
const PAIR_SEPARATOR = /[=:]/;
const STACK_FRAME_VALUE = /^[([]/;
// A quoted value is consumed whole, however long and even if unterminated.
const QUOTED_VALUE = /"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?/y;
// Cookie and Authorization values hold several secrets separated by `;` or
// `,`, so the whole rest of the line goes.
const REST_OF_LINE_VALUE = /[^\n]+/y;
const REST_OF_LINE_NAME_WORDS = new Set(['authorization', 'cookie', 'cookies']);
// An auth scheme in any case, then its credentials to the end of the line
// (Digest and AWS put several comma-separated secrets there).
const AUTH_SCHEMES =
  'bearer|basic|token|digest|negotiate|ntlm|hoba|mutual|aws4-hmac-sha256';
const AUTH_SCHEME_VALUE = new RegExp(`(?:${AUTH_SCHEMES})\\s+[^\\n]+`, 'iy');
// After `=` or `:` a value stops at `&` and `;` (query and cookie syntax).
// After a bare space it runs to whitespace, so `Tr0ub4dor&3` goes whole.
const PAIR_PLAIN_VALUE = /\[redacted\]|[^\s&"',;)}\]]+/y;
const WORD_PLAIN_VALUE = /\[redacted\]|[^\s"',)}\]]+/y;
const LABEL_SEPARATOR = /^:\s/;
// Credential words common in prose before `: ` (`Failed to refresh token:
// network error`, `Invalid key: expected string`). After them a value is
// masked only if it looks like a secret; password-class words always mask.
const LENIENT_NAME_WORDS = new Set([
  'auth',
  'jwt',
  'key',
  'keys',
  'session',
  'sid',
  'signature',
  'token',
  'tokens',
]);
const NUMERIC_VALUE = /^[\d\s.:/-]+$/;
const DIGITS = /\d/g;
const SECRET_SYMBOL = /[_+=~!@#$%^&*]/;
// Credential words whose value is often a short number (`pin 4417`).
const NUMERIC_SECRET_NAME_WORDS = new Set([
  'code',
  'otp',
  'passcode',
  'pin',
  'totp',
]);
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

function execAt(pattern: RegExp, value: string, index: number) {
  pattern.lastIndex = index;
  return pattern.exec(value)?.[0];
}

/**
 * After a single credential word and a bare space, only a value that looks
 * like a secret is masked, so prose (`the token expired`, `password is
 * required`, `session started 2026-10-13`) stays readable.
 */
function looksLikeSecret(candidate: string, words: string[]): boolean {
  if (candidate.startsWith('/') || candidate.includes('://')) return false;
  if (NUMERIC_VALUE.test(candidate))
    return (
      words.some((word) => NUMERIC_SECRET_NAME_WORDS.has(word)) &&
      (candidate.match(DIGITS)?.length ?? 0) >= 4
    );
  if (candidate.length < 6) return false;
  if (HAS_DIGIT.test(candidate) && HAS_LETTER.test(candidate)) return true;
  if (SECRET_SYMBOL.test(candidate)) return true;
  return (
    candidate.length >= 16 && LOWER.test(candidate) && UPPER.test(candidate)
  );
}

/**
 * How a credential name meets its value:
 * - `pair`: `=` or `:` (and JSON `"token":`). Any value is masked.
 * - `label`: a lenient single word then `: ` (`token: x`). Only a secret.
 * - `header`: a multi-word name then a space (`x-api-key abc`). Any value
 *   except a stack frame.
 * - `word`: a single word then a space (`Password hunter2`). Only a secret.
 */
type PairSeparator = 'pair' | 'label' | 'header' | 'word';

function classifySeparator(separator: string, words: string[]): PairSeparator {
  if (!PAIR_SEPARATOR.test(separator))
    return words.length > 1 ? 'header' : 'word';
  const lenient = words.length === 1 && LENIENT_NAME_WORDS.has(words[0] ?? '');
  return lenient && LABEL_SEPARATOR.test(separator) ? 'label' : 'pair';
}

/** The extent of the value that follows a credential name, or undefined. */
function secretValueAt(
  value: string,
  start: number,
  words: string[],
  separator: PairSeparator,
): string | undefined {
  const strict = separator === 'pair' || separator === 'header';
  const quoted = execAt(QUOTED_VALUE, value, start);
  if (quoted) {
    const closed = quoted.length > 1 && quoted.endsWith(quoted[0] ?? '');
    const inner = quoted.slice(1, closed ? -1 : undefined);
    return strict || looksLikeSecret(inner, words) ? quoted : undefined;
  }
  if (
    separator === 'pair' &&
    words.some((word) => REST_OF_LINE_NAME_WORDS.has(word))
  )
    return execAt(REST_OF_LINE_VALUE, value, start);
  // `token bearer of bad news` is prose; after `=`, `:` or a header name an
  // auth scheme introduces a credential.
  if (separator !== 'word') {
    const scheme = execAt(AUTH_SCHEME_VALUE, value, start);
    if (scheme) return scheme;
  }
  const plain = execAt(
    separator === 'pair' || separator === 'label'
      ? PAIR_PLAIN_VALUE
      : WORD_PLAIN_VALUE,
    value,
    start,
  );
  if (!plain || plain === REDACTED) return plain;
  if (separator === 'pair') return plain;
  // `at fetchWithAuth (url)` and `refreshToken [as x]` are stack frames.
  if (STACK_FRAME_VALUE.test(plain)) return undefined;
  return separator === 'header' || looksLikeSecret(plain, words)
    ? plain
    : undefined;
}

function redactSecretPairs(value: string): string {
  let output = '';
  let cursor = 0;
  for (const match of value.matchAll(PAIR_NAME_PATTERN)) {
    if (match.index < cursor) continue;
    const words = nameWords(match[1] ?? '');
    if (!isSecretName(words)) continue;
    const valueStart = match.index + match[0].length;
    const secret = secretValueAt(
      value,
      valueStart,
      words,
      classifySeparator(match[2] ?? '', words),
    );
    if (!secret) continue;
    const quote = secret[0] === '"' || secret[0] === "'" ? secret[0] : '';
    const closed = quote && secret.length > 1 && secret.endsWith(quote);
    output += `${value.slice(cursor, valueStart)}${quote}${REDACTED}${closed ? quote : ''}`;
    cursor = valueStart + secret.length;
  }
  return cursor === 0 ? value : `${output}${value.slice(cursor)}`;
}

// `Bearer x` / `Basic x` outside a name=value pair.
const AUTH_SCHEME_TOKEN_PATTERN = new RegExp(
  `\\b(${AUTH_SCHEMES})\\s+(?!\\[redacted\\])([\\w.~+/=-]+)`,
  'gi',
);
const TOKEN_SYMBOL = /[\d.~+/=_-]/;

/**
 * `Bearer` as written in a header masks any credential of 4+ characters, so
 * `Bearer of the message` stays. Any other spelling (`the bearer of bad
 * news`, `Basic information`) masks only a token that looks like a
 * credential: a digit or symbol, mixed case past the first letter, or 20+
 * characters. A path (`token /api/session/refresh failed`) is never one.
 */
function redactAuthSchemeToken(match: string, scheme: string, token: string) {
  if (token.startsWith('/')) return match;
  const headerSpelling = scheme === 'Bearer' || scheme === 'BEARER';
  const credential =
    (headerSpelling && (token.length >= 4 || TOKEN_SYMBOL.test(token))) ||
    (token.length >= 6 && TOKEN_SYMBOL.test(token)) ||
    (token.length >= 8 && UPPER.test(token.slice(1)) && LOWER.test(token)) ||
    token.length >= 20;
  return credential ? `${scheme} ${REDACTED}` : match;
}
const JWT_PATTERN = /(?<![\w-])eyJ[\w-]{2,}\.[\w-]{2,}(?:\.[\w-]+)?/g;
// Well-known API key prefixes too short for the long-token rule.
const PREFIXED_KEY_PATTERN =
  /(?<![\w-])(?:(?:sk|pk|rk)-[\w-]{16,}|(?:gh[pousr]_|github_pat_)\w{20,}|xox[abprs]-[\w-]{10,}|(?:AKIA|ASIA)[A-Z0-9]{16}(?![\w-]))/g;
const EMAIL_PATTERN =
  /(?<![\w.%+-])[\w.%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
// A labelled number (`tel:`, `phone:`, `mobile:`, `cell:`, `fax:`, also
// `phoneNumber=` or `Phone 555 …`): any 7+ digit-and-separator run after it.
const PHONE_LABEL_PATTERN =
  /\b(tel|phone|mobile|cell|fax)((?:[_-]?(?:number|num|no))?(?:\s*[:=]\s*|\s+))\+?[\d(][\d\s().-]{5,}\d/gi;
// International (+…), North American, trunk-prefixed (0…) and 7-digit local
// numbers. Never starts after `.`, `/` or `-`, so dates and paths are left
// alone. After `:` it may start, unless it is a stack coordinate.
const PHONE_PATTERN =
  /(?<![\w+./-])(?:\+\d[\d\s().-]{6,}\d|(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}|0\d{2,4}[\s-]?\d{3,4}(?:[\s-]?\d{3,4})?|\d{3}-\d{4})(?![\w-])/g;
const ALL_DIGITS = /^\d+$/;
// A file or path (`main.js:`, `src/x:`, `<anonymous>:`) before a line
// number, and the same plus `line:` before a column.
const BEFORE_LINE = /(?:[./][^\s:]*|<anonymous>):$/;
const BEFORE_COLUMN = /(?:[./][^\s:]*|<anonymous>):\d+:$/;
const AFTER_LINE = /^:\d+/;

/**
 * A digits-only match is a stack coordinate, not a phone number, when it is
 * the line of `name:line:col` or the column after `name:line:`.
 */
function redactPhone(match: string, offset: number, text: string): string {
  if (text[offset - 1] === ':' && ALL_DIGITS.test(match)) {
    // Bounded look-behind: a file name, a line number and two colons.
    const before = text.slice(Math.max(0, offset - 32), offset);
    const after = text.slice(offset + match.length, offset + match.length + 16);
    if (BEFORE_COLUMN.test(before)) return match;
    if (BEFORE_LINE.test(before) && AFTER_LINE.test(after)) return match;
  }
  return REDACTED;
}
// Long runs of letters and digits: hex digests, API keys, base64 secrets.
const LONG_TOKEN_PATTERN = /(?<![\w+/=-])[\w+/-]{32,}={0,2}(?![\w+/=-])/g;

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
  return redactSecretPairs(stripUrlQueries(value))
    .replace(AUTH_SCHEME_TOKEN_PATTERN, redactAuthSchemeToken)
    .replace(JWT_PATTERN, REDACTED)
    .replace(PREFIXED_KEY_PATTERN, REDACTED)
    .replace(EMAIL_PATTERN, REDACTED)
    .replace(PHONE_LABEL_PATTERN, `$1$2${REDACTED}`)
    .replace(PHONE_PATTERN, redactPhone)
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
