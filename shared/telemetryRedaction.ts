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
const QUERY_START = /[?#]/;

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

// --- Credential context ---------------------------------------------------

// A name is a credential name if any of its words is one of these.
const CREDENTIAL_WORDS = new Set([
  'apikey',
  'auth',
  'authorization',
  'basic',
  'bearer',
  'cookie',
  'key',
  'otp',
  'pass',
  'passcode',
  'passphrase',
  'passwd',
  'password',
  'pin',
  'pwd',
  'secret',
  'session',
  'token',
]);
// A name: letters, `_`, `$`, `.` and `-`, no digits (`s3cr3t-api-key` is a
// value, not a name).
const NAME = /^[A-Za-z_$][A-Za-z_$.-]{0,63}$/;
const NAME_SEPARATORS = /[._$-]+/;
const NAME_WORDS = /[A-Z]+(?![a-z])|[A-Z]?[a-z]+/g;
// Auth schemes: after `Authorization: bearer` the credential is next.
const AUTH_SCHEMES = new Set(['basic', 'bearer', 'digest', 'token']);
// A separator written as its own token keeps the credential context.
const SEPARATOR_TOKENS = new Set([':', '=', ':=', '->', '=>', '-', '–', '—']);
// An opening quote alone after a credential word opens its quoted value.
const QUOTES = new Set(['"', "'"]);
// `password="…`, `token:=`: a credential name joined to its value.
const JOINED_CREDENTIAL = /^([\w.$-]{1,64}?)[:=]+(.*)$/s;
// What may follow a joined name without being a value (`password=`, `pin:,`).
const NO_VALUE = /^[)\]}>.,;:!?…]*$/;

/**
 * True when any word of the name is a credential word, however the name is
 * written: `password`, `Password:`, `x-api-key`, `api_key=`, `accessToken`,
 * `clientSecret`, `config.password`, `set-cookie`.
 */
function isCredentialName(value: string): boolean {
  const name = value.replace(/[:=]+$/, '');
  if (!NAME.test(name)) return false;
  const words = name
    .split(NAME_SEPARATORS)
    .flatMap((part) => part.match(NAME_WORDS) ?? [])
    .map((word) => word.toLowerCase());
  return (
    words.some((word) => CREDENTIAL_WORDS.has(word)) ||
    words.some((word, index) =>
      CREDENTIAL_WORDS.has(`${word}${words[index + 1] ?? ''}`),
    )
  );
}

/**
 * The quote a credential value opens and does not close in this token, so
 * the redaction runs on to the closing quote: `password="two words"`.
 */
function openedQuote(value: string): string | undefined {
  const quote = value[0] ?? '';
  return QUOTES.has(quote) && !value.slice(1).includes(quote)
    ? quote
    : undefined;
}

/**
 * Renders each token, or marks it undefined to redact, applying the one
 * context rule: the value after a credential name is always redacted.
 * Only a separator token or a lone opening quote keeps the context alive;
 * the first token after that goes whatever its shape, punctuation included,
 * and a quoted value goes through its closing quote or the end of the line.
 */
function renderWithCredentialContext(
  tokens: (Token | undefined)[],
  separators: string[],
): (string | undefined)[] {
  const rendered: (string | undefined)[] = [];
  let quote: string | undefined;
  let credentialNext = false;
  for (const [index, token] of tokens.entries()) {
    const afterCredential = credentialNext;
    credentialNext = false;
    if (quote && (separators[index] ?? '').includes('\n')) quote = undefined;
    if (!token) {
      rendered.push('');
      continue;
    }
    const { raw, core } = token;
    if (quote) {
      rendered.push(undefined);
      if (raw.includes(quote)) quote = undefined;
      continue;
    }
    const joined = JOINED_CREDENTIAL.exec(core);
    if (joined && isCredentialName(joined[1] ?? '')) {
      // `password=x` goes whole; `password=` and `token:=` leave the value
      // for the next token, and `password="` opens a quoted one.
      rendered.push(undefined);
      const value = `${joined[2] ?? ''}${token.trailing}`;
      quote = openedQuote(value);
      credentialNext = !quote && NO_VALUE.test(value);
    } else if (afterCredential && SEPARATOR_TOKENS.has(raw)) {
      rendered.push(raw);
      credentialNext = true;
    } else if (afterCredential && QUOTES.has(raw)) {
      rendered.push(raw);
      quote = raw;
    } else if (afterCredential) {
      rendered.push(undefined);
      quote = openedQuote(raw);
      credentialNext = AUTH_SCHEMES.has(core.toLowerCase());
    } else {
      rendered.push(renderSafe(token));
      credentialNext = isCredentialName(core);
    }
  }
  return rendered;
}

// --- Numbers and rendering ------------------------------------------------

const HAS_DIGIT = /\d/;

/** A short number beside anything else with a digit is part of a longer one. */
function suppressDigitNeighbours(
  tokens: (Token | undefined)[],
  rendered: (string | undefined)[],
): void {
  for (const [index, token] of tokens.entries()) {
    if (!token || !NUMBER.test(token.core)) continue;
    const neighbours = [tokens[index - 1], tokens[index + 1]];
    if (neighbours.some((other) => other && HAS_DIGIT.test(other.core)))
      rendered[index] = undefined;
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
