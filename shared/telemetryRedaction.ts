/**
 * Report sanitizing for Error telemetry and User reports, fail-closed: only
 * shapes known to be safe survive, everything else becomes `[redacted]`.
 * Runs in the browser before a report is sent and again on the Worker before
 * a report reaches a GitHub issue or Workers Logs. Every pass is linear.
 * Stack traces have their own frame grammar in `stackFrames.ts`.
 */

import { truncateText } from './text.ts';

export const REDACTED = '[redacted]';
export const TRUNCATED = '… [truncated]';

// Sanitizing reads at most this many times a field's limit, so an oversized
// field costs bounded CPU however large the request body was.
export const SANITIZE_INPUT_FACTOR = 4;
const WHITESPACE = /\s/;

// Five digits, however separated, may be a phone number or an id:
// `555-123-4567`, `555.123.4567`, `1a2b3c4d5e`.
const DIGIT = /\d/g;
const MAX_DIGITS = 4;

/** True when `value` holds more digits in total than a short number may. */
export function hasTooManyDigits(value: string): boolean {
  return (value.match(DIGIT)?.length ?? 0) > MAX_DIGITS;
}

// The safe word and number shapes, shared by free text and path segments.
const WORD = /^\p{L}+(?:['’-]\p{L}+)*$/u;
const WORD_MAX = 24;
const NUMBER = /^\d{1,4}$/;

function isWord(value: string): boolean {
  return WORD.test(value) && value.length <= WORD_MAX;
}

// A URL path segment: its characters, then its parts split at `-_.~+`.
const SEGMENT_CHARACTERS = /^@?[\w.~+()[\]-]{1,64}$/;
const SEGMENT_PART_SEPARATORS = /[-_.~+]+/;
const SEGMENT_WRAPPERS = /[()[\]]/g;
// `v1`, `v2`: an API version.
const VERSION = /^v\d{1,3}$/i;
// A file extension (`.js`, `.map`), and the content hash a build puts in a
// file name (`index-C4kL9x.js`): accepted only in a name with an extension.
const FILE_EXTENSION = /\.[A-Za-z]{1,5}$/;
const CONTENT_HASH = /^[A-Za-z0-9]{4,16}$/;

function isSafeSegmentPart(part: string): boolean {
  return isWord(part) || NUMBER.test(part) || VERSION.test(part);
}

/**
 * A plain path segment: every part a word, a short number or an API version
 * (`api`, `v1`, `users`, `1234`), or a file name whose parts may also be a
 * content hash (`index-C4kL9x.js`). At most 4 digits in total, `@scope`,
 * `(group)` and `[slug]` allowed. A random-looking token such as
 * `XkfQpLmZr9Ab` is not.
 */
function isSafeSegment(segment: string): boolean {
  if (!SEGMENT_CHARACTERS.test(segment) || hasTooManyDigits(segment))
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
 * An http(s) URL as origin + path: no credentials, query string or fragment,
 * and only plain path segments. Anything else becomes `[redacted]`.
 */
export function toPathOnlyUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return REDACTED;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return REDACTED;
  // A host can carry a phone number too (`555-123-4567.example`).
  if (hasTooManyDigits(url.hostname)) return REDACTED;
  return `${url.origin}${sanitizePathSegments(url.pathname, /\//)}`;
}

// --- Tokens ---------------------------------------------------------------

// A token is split into leading wrappers, a core and trailing wrappers.
const LEADING_WRAPPERS = new Set('([{<"\'`!¡¿');
const TRAILING_WRAPPERS = new Set(')]}>"\'`.,:;!?…');
// The closer for each opener a URL may be wrapped in.
const CLOSERS: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
  '<': '>',
  '"': '"',
  "'": "'",
  '`': '`',
};

type Token = {
  leading: string;
  core: string;
  trailing: string;
  raw: string;
};

function splitToken(raw: string): Token {
  let start = 0;
  let end = raw.length;
  while (start < end && LEADING_WRAPPERS.has(raw[start] ?? '')) start += 1;
  while (end > start && TRAILING_WRAPPERS.has(raw[end - 1] ?? '')) end -= 1;
  return {
    leading: raw.slice(0, start),
    core: raw.slice(start, end),
    trailing: raw.slice(end),
    raw,
  };
}

/** Whitespace-separated tokens and the whitespace between them. */
function tokenize(value: string) {
  const parts = value.split(/(\s+)/);
  const tokens: (Token | undefined)[] = [];
  const separators: string[] = [];
  for (let index = 0; index < parts.length; index += 2) {
    const raw = parts[index] ?? '';
    tokens.push(raw ? splitToken(raw) : undefined);
    separators.push(index === 0 ? '' : (parts[index - 1] ?? ''));
  }
  return { tokens, separators };
}

// --- Safe shapes ----------------------------------------------------------

// Punctuation is safe only as short ordinary punctuation (`'<',`, `"…"`,
// `- [ ]`) or a run of one mark (`##`, three backticks, `...`). A mixed
// symbol run such as `!@#$%^&*()` can be a password, so it is redacted.
const ORDINARY_PUNCTUATION = /^[.,;:!?()[\]{}<>'"`\-–—…/]{1,4}$/u;
const REPEATED_MARK = /^([\p{P}\p{S}])\1{0,15}$/u;
// `foo()` arrives as `foo(`: its `)` is a trailing wrapper.
const IDENTIFIER = /^[A-Za-z_$]+(?:\.[A-Za-z_$]+)*(?:\(\)?)?$/;
const IDENTIFIER_MAX = 40;
const HTTP_URL = /^https?:\/\//i;
export const QUERY_START = /[?#]/;

function isSafePunctuation(raw: string): boolean {
  return ORDINARY_PUNCTUATION.test(raw) || REPEATED_MARK.test(raw);
}

// One mark of sentence punctuation after a wrapper's closer: `(url).`
const AFTER_CLOSER = /[.,;:]$/;

/**
 * A URL token path-only. With no query or fragment its trailing wrappers
 * come back; with one, everything after `?` or `#` is dropped, and only the
 * closers of openers before the URL return (plus one `.,;:` after them):
 * `(https://x/a?q=1).` keeps `).`, but `https://x/a?q=?!` keeps nothing.
 */
function renderUrl({ leading, core, trailing }: Token): string | undefined {
  const text = `${core}${trailing}`;
  if (!QUERY_START.test(text)) {
    const url = toPathOnlyUrl(core);
    return url === REDACTED ? undefined : `${leading}${url}${trailing}`;
  }
  const after = AFTER_CLOSER.exec(text)?.[0] ?? '';
  let rest = text.slice(0, text.length - after.length);
  let closers = '';
  for (const opener of [...leading].reverse()) {
    const closer = CLOSERS[opener];
    if (!closer || !rest.endsWith(closer)) break;
    closers = `${closer}${closers}`;
    rest = rest.slice(0, rest.length - closer.length);
  }
  const url = toPathOnlyUrl(rest);
  if (url === REDACTED) return undefined;
  // Text after the URL counts only if a closer marks where the URL ended.
  return `${leading}${url}${closers}${closers ? after : ''}`;
}

/** The safe rendering of a token, or undefined when it must be redacted. */
function renderSafe(token: Token): string | undefined {
  const { core, raw } = token;
  if (isSafePunctuation(raw)) return raw;
  if (HTTP_URL.test(core)) return renderUrl(token);
  if (
    isWord(core) ||
    NUMBER.test(core) ||
    (IDENTIFIER.test(core) && core.length <= IDENTIFIER_MAX)
  )
    return raw;
  return undefined;
}

// --- Credential names -----------------------------------------------------

// A word holds a credential word if it contains one of these anywhere
// (`accesstoken`, `clientsecret`, `xapikey`, `sessionid`)...
const CREDENTIAL_SUBSTRINGS = [
  'apikey',
  'bearer',
  'cookie',
  'credential',
  'passcode',
  'passphrase',
  'passw',
  'pwd',
  'secret',
  'session',
  'token',
];
// ...or is one of these whole...
const CREDENTIAL_WHOLE_WORDS = new Set(['basic', 'pass', 'pin', 'sid']);
// ...or ends in `key` (`secretkey`), starts or ends in `otp` (`totp`), or
// contains `auth` (`oauth`, `authorization`). Ordinary words that only
// happen to contain one are not credential words.
const ORDINARY_WORDS = new Set([
  'donkey',
  'hockey',
  'jockey',
  'lackey',
  'monkey',
  'secretary',
  'tokenize',
  'tokenized',
  'tokenizer',
  'turkey',
  'unauthenticated',
  'unauthorised',
  'unauthorized',
  'whiskey',
]);
const OTP = /^otp|otp$/;
const AUTHOR = /^author(?!i[sz])/;
// Words that may follow a credential word inside its name (`session_id`).
const NAME_QUALIFIERS = new Set([
  'error',
  'exception',
  'header',
  'id',
  'key',
  'name',
  'type',
  'value',
]);
// A name: letters, `_`, `$`, `.` and `-`, no digits (`s3cr3t-api-key` is a
// value, not a name).
const NAME = /^[A-Za-z_$][A-Za-z_$.-]{0,63}$/;
const NAME_SEPARATORS = /[._$-]+/;
const NAME_WORDS = /[A-Z]+(?![a-z])|[A-Z]?[a-z]+/g;
// The credential words a name may end in (`accesstoken`, `password`).
const CREDENTIAL_SUFFIXES = [
  ...CREDENTIAL_SUBSTRINGS,
  'auth',
  'authorization',
  'key',
  'otp',
  'password',
  'passwd',
];

/** `tokens` is `token`: a plural matches as its singular (`pass` stays). */
function singular(word: string): string {
  return word.length > 3 && word.endsWith('s') && !word.endsWith('ss')
    ? word.slice(0, -1)
    : word;
}

function holdsCredentialWord(rawWord: string): boolean {
  const word = singular(rawWord);
  if (ORDINARY_WORDS.has(rawWord) || ORDINARY_WORDS.has(word)) return false;
  if (CREDENTIAL_WHOLE_WORDS.has(word)) return true;
  if (CREDENTIAL_SUBSTRINGS.some((part) => word.includes(part))) return true;
  if (word.endsWith('key')) return true;
  if (OTP.test(word)) return true;
  return word.includes('auth') && !AUTHOR.test(word);
}

/**
 * True when the word ends in its credential word, or in one plus a
 * qualifier: `accesstoken`, `sessionid`, but not `tokenabc`.
 */
function endsInCredentialWord(rawWord: string): boolean {
  const word = singular(rawWord);
  if (CREDENTIAL_WHOLE_WORDS.has(word)) return true;
  if (CREDENTIAL_SUFFIXES.some((part) => word.endsWith(part))) return true;
  return [...NAME_QUALIFIERS].some(
    (qualifier) =>
      word.length > qualifier.length &&
      word.endsWith(qualifier) &&
      CREDENTIAL_SUFFIXES.some((part) =>
        word.slice(0, -qualifier.length).endsWith(part),
      ),
  );
}

/** The lower-case words of a camelCase, snake_case, kebab or dotted name. */
function nameWords(name: string): string[] {
  return name
    .split(NAME_SEPARATORS)
    .flatMap((part) => part.match(NAME_WORDS) ?? [])
    .map((word) => word.toLowerCase());
}

/**
 * How a token relates to credentials. `name`: it is a credential name
 * (`password`, `Password:`, `accessToken`, `x_apikey`, `session_id`), so
 * the value after it is redacted. `joined`: a credential word with more
 * after it in the same token (`password-correcthorse`, `passwordhunter`),
 * which may itself hold the value, so the token is redacted too.
 */
function credentialRole(core: string): 'name' | 'joined' | undefined {
  const name = core.replace(/[:=]+$/, '');
  if (!NAME.test(name)) return undefined;
  const words = nameWords(name);
  const paired = words.map((word, index) => `${word}${words[index + 1] ?? ''}`);
  let last = -1;
  for (const [index, word] of words.entries())
    if (holdsCredentialWord(word) || holdsCredentialWord(paired[index] ?? ''))
      last = index;
  if (last === -1) return undefined;
  const lastWord = words[last] ?? '';
  const ends =
    endsInCredentialWord(lastWord) || endsInCredentialWord(paired[last] ?? '');
  const qualified = words
    .slice(last + 1)
    .every((word) => NAME_QUALIFIERS.has(singular(word)));
  return ends && qualified ? 'name' : 'joined';
}

// --- Credential context ---------------------------------------------------

// Auth schemes: after `Authorization: bearer` the credential is next.
const AUTH_SCHEMES = new Set(['basic', 'bearer', 'digest', 'token']);
// A separator written as its own token keeps the credential context.
const SEPARATOR_TOKENS = new Set([':', '=', ':=', '->', '=>', '-', '–', '—']);
const QUOTES = new Set(['"', "'"]);
// `password="…`, `token:=`: a credential name joined to its value.
const JOINED_CREDENTIAL = /^([\w.$-]{1,64}?)[:=]+(.*)$/s;
// What may follow a joined name without being a value (`password=`, `pin:,`).
const NO_VALUE = /^[)\]}>.,;:!?…]*$/;
const VALUE_WRAPPERS = /^["'`([{<]+|[)\]}>"'`.,;:!?…]+$/g;

/**
 * Where the credential context stands between tokens: `none`, `awaitValue`
 * (the next token is a credential's value; `sameLine` when it only follows
 * a value that was itself a credential name) or `inQuote` (inside a quoted
 * value, until its closing quote). `inQuote` and a `sameLine` wait end at a
 * line break.
 */
type CredentialState =
  | { kind: 'none' }
  | { kind: 'awaitValue'; sameLine?: boolean }
  | { kind: 'inQuote'; quote: string };

const NONE: CredentialState = { kind: 'none' };
const AWAIT_VALUE: CredentialState = { kind: 'awaitValue' };

type Step = { text: string | undefined; next: CredentialState };

/**
 * The state after a credential's value, shared by the joined form
 * (`password=x`) and the separated one (`password: x`) so they cannot
 * drift: an empty value or an auth scheme (`Bearer`, any case) leaves the
 * credential for the next token, and an opening quote runs to its close.
 */
function afterValue(value: string): CredentialState {
  if (NO_VALUE.test(value)) return AWAIT_VALUE;
  const quote = value[0] ?? '';
  if (QUOTES.has(quote) && !value.slice(1).includes(quote))
    return { kind: 'inQuote', quote };
  const bare = value.replace(VALUE_WRAPPERS, '').toLowerCase();
  return AUTH_SCHEMES.has(bare) ? AWAIT_VALUE : NONE;
}

/** Outside any credential: render safely, unless the token is one. */
function stepNone(token: Token): Step {
  const joined = JOINED_CREDENTIAL.exec(token.core);
  if (joined && credentialRole(joined[1] ?? '')) {
    return {
      text: undefined,
      next: afterValue(`${joined[2] ?? ''}${token.trailing}`),
    };
  }
  const role = credentialRole(token.core);
  if (role === 'joined') return { text: undefined, next: AWAIT_VALUE };
  return {
    text: renderSafe(token),
    next: role === 'name' ? AWAIT_VALUE : NONE,
  };
}

/**
 * After a credential name: the value goes, whatever its shape. A value that
 * is itself a credential name keeps the context for the next token.
 */
function stepAwaitValue(token: Token): Step {
  const { raw } = token;
  if (SEPARATOR_TOKENS.has(raw)) return { text: raw, next: AWAIT_VALUE };
  if (QUOTES.has(raw))
    return { text: raw, next: { kind: 'inQuote', quote: raw } };
  const next = afterValue(raw);
  return {
    text: undefined,
    next:
      next === NONE && credentialRole(token.core)
        ? { kind: 'awaitValue', sameLine: true }
        : next,
  };
}

/** Inside a quoted value: everything goes, through the closing quote. */
function stepInQuote(token: Token, quote: string): Step {
  return {
    text: undefined,
    next: token.raw.includes(quote) ? NONE : { kind: 'inQuote', quote },
  };
}

/**
 * Renders each token, or marks it undefined to redact, applying the one
 * context rule: the value after a credential name is always redacted.
 */
function renderWithCredentialContext(
  tokens: (Token | undefined)[],
  separators: string[],
): (string | undefined)[] {
  const rendered: (string | undefined)[] = [];
  let state: CredentialState = NONE;
  for (const [index, token] of tokens.entries()) {
    const lineBreak = (separators[index] ?? '').includes('\n');
    if (
      lineBreak &&
      (state.kind === 'inQuote' ||
        (state.kind === 'awaitValue' && state.sameLine))
    )
      state = NONE;
    if (!token) {
      rendered.push('');
      continue;
    }
    let step: Step;
    if (state.kind === 'awaitValue') step = stepAwaitValue(token);
    else if (state.kind === 'inQuote') step = stepInQuote(token, state.quote);
    else step = stepNone(token);
    rendered.push(step.text);
    state = step.next;
  }
  return rendered;
}

// --- Numbers and rendering ------------------------------------------------

const HAS_DIGIT = /\d/;
const DIGITS = /\d/g;
// Separators a number may be written with as their own tokens: `555 - 1234`.
const NUMBER_RUN_SEPARATORS = new Set(['-', '.', '/', '(', ')', '+']);

function isNumberToken(token: Token | undefined): token is Token {
  return Boolean(token && NUMBER.test(token.core));
}

function isRunSeparator(token: Token | undefined): boolean {
  return Boolean(token && NUMBER_RUN_SEPARATORS.has(token.raw));
}

/**
 * Short numbers that together make a longer one are redacted: a number
 * beside any other token with a digit (`555 123-4567`), and a run of
 * numbers and separator tokens with 5+ digits in total (`555 - 123 - 4567`).
 * `page 3 - 4` and `1 / 2` stay.
 */
function suppressDigitNeighbours(
  tokens: (Token | undefined)[],
  rendered: (string | undefined)[],
): void {
  for (const [index, token] of tokens.entries()) {
    if (!isNumberToken(token)) continue;
    const neighbours = [tokens[index - 1], tokens[index + 1]];
    if (
      neighbours.some(
        (other) =>
          other && !isRunSeparator(other) && HAS_DIGIT.test(other.core),
      )
    )
      rendered[index] = undefined;
  }
  let start = 0;
  while (start < tokens.length) {
    if (!isNumberToken(tokens[start]) && !isRunSeparator(tokens[start])) {
      start += 1;
      continue;
    }
    let end = start;
    let digits = 0;
    while (
      end < tokens.length &&
      (isNumberToken(tokens[end]) || isRunSeparator(tokens[end]))
    ) {
      const token = tokens[end];
      if (isNumberToken(token)) digits += token.core.match(DIGITS)?.length ?? 0;
      end += 1;
    }
    if (digits > 4)
      for (let index = start; index < end; index += 1)
        rendered[index] = undefined;
    start = end;
  }
}

// Kept after a redacted token, so sentences still read.
const SENTENCE_PUNCTUATION = /[.,;:!?…]+$/;
const TRAILING_SENTENCE_PUNCTUATION = /[.,;:!?…]*$/;

/**
 * Joins the rendered tokens with their original whitespace. A redacted
 * token becomes `[redacted]`, collapsing into the one before it; its
 * sentence punctuation stays, unless the token was all punctuation.
 */
function renderTokens(
  tokens: (Token | undefined)[],
  separators: string[],
  rendered: (string | undefined)[],
): string {
  let output = '';
  for (const [index, token] of tokens.entries()) {
    const separator = separators[index] ?? '';
    const text = rendered[index];
    if (text !== undefined) {
      output += `${separator}${text}`;
      continue;
    }
    const punctuation = token?.core
      ? (SENTENCE_PUNCTUATION.exec(token.raw)?.[0] ?? '')
      : '';
    if (index > 0 && rendered[index - 1] === undefined)
      output = `${output.replace(TRAILING_SENTENCE_PUNCTUATION, '')}${punctuation}`;
    else output += `${separator}${REDACTED}${punctuation}`;
  }
  return output;
}

/**
 * Keeps only safe tokens (words, short numbers, code identifiers,
 * punctuation, path-only http(s) URLs); every other token becomes
 * `[redacted]`, and consecutive ones collapse. The value after a credential
 * name is always redacted, and a short number next to another number
 * (`555 123 4567`) is redacted with it.
 */
export function redactTelemetryText(value: string): string {
  const { tokens, separators } = tokenize(value);
  const rendered = renderWithCredentialContext(tokens, separators);
  suppressDigitNeighbours(tokens, rendered);
  return renderTokens(tokens, separators, rendered);
}

/**
 * Drops the trailing partial line or word a hard cut may have left: it could
 * be the front half of a value that would not have been safe whole. Never
 * cuts below `floor`.
 */
export function cutAtLastBreak(
  value: string,
  floor: number,
  isBreak: (char: string) => boolean = (char) => WHITESPACE.test(char),
): string {
  let end = value.length;
  while (end > floor && !isBreak(value[end - 1] ?? '')) end -= 1;
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

/**
 * Sanitizes a free-text field, then truncates it to at most `max` characters,
 * visible marker included. Input past four times `max` is never read. Pass
 * `inputWasCut` when the caller already cut the value (a bounded read): its
 * trailing partial token is dropped, since it may be the front half of a
 * value that would not have been safe whole.
 */
export function sanitizeTelemetryText(
  value: string,
  max: number,
  { inputWasCut = false }: { inputWasCut?: boolean } = {},
): string {
  const bound = max * SANITIZE_INPUT_FACTOR;
  const cut = inputWasCut || value.length > bound;
  const sanitized = redactTelemetryText(
    cut ? cutAtLastBreak(value.slice(0, bound), inputWasCut ? 0 : max) : value,
  );
  return truncateWithMarker(sanitized, max, cut);
}
