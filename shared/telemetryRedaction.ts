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

// A URL path segment: a plain file or directory name, `@scope` allowed, no
// run of 5+ digits (ids, phone numbers), at most 64 characters.
const SAFE_SEGMENT = /^@?[\w.~+()[\]-]{1,64}$/;
const DIGIT_RUN = /\d{5}/;

/** Keeps a path's plain segments; any other segment becomes `[redacted]`. */
export function sanitizePathSegments(path: string, separator: RegExp): string {
  return path
    .split(separator)
    .map((segment) =>
      segment === '' || (SAFE_SEGMENT.test(segment) && !DIGIT_RUN.test(segment))
        ? segment
        : REDACTED,
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
  return `${url.origin}${sanitizePathSegments(url.pathname, /\//)}`;
}

// A token is split into leading wrappers, a core and trailing wrappers.
const LEADING_WRAPPERS = new Set('([{<"\'`!¡¿');
const TRAILING_WRAPPERS = new Set(')]}>"\'`.,:;!?…');
// Kept after a redacted token, so sentences still read.
const SENTENCE_PUNCTUATION = /[.,;:!?…]+$/;
// The safe core shapes.
const PUNCTUATION_ONLY = /^[\p{P}\p{S}]{1,16}$/u;
const WORD = /^\p{L}+(?:['’-]\p{L}+)*$/u;
const WORD_MAX = 24;
const NUMBER = /^\d{1,4}$/;
// `foo()` arrives as `foo(`: its `)` is a trailing wrapper.
const IDENTIFIER = /^[A-Za-z_$]+(?:\.[A-Za-z_$]+)*(?:\(\)?)?$/;
const IDENTIFIER_MAX = 40;
const HTTP_URL = /^https?:\/\//i;
const HAS_DIGIT = /\d/;
// The token after one of these is always redacted, whatever its shape.
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
const NAME_PARTS = /[-_]/;

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

// A credential name is a plain name: letters, `-` and `_`, no digits.
const PLAIN_NAME = /^[a-z][a-z_-]{0,63}$/;
// Auth schemes: after `Authorization: bearer` the credential is next.
const AUTH_SCHEMES = new Set(['basic', 'bearer', 'digest', 'token']);
// A separator written as its own token keeps the credential context.
const SEPARATOR_TOKENS = new Set([':', '=', '-', '–', '—', '=>', ':=']);

/** `password`, `Password:`, `api_key=`, `x-api-key:` and `set-cookie` count. */
function isCredentialName(value: string): boolean {
  const name = value.replace(/[:=]+$/, '').toLowerCase();
  if (!PLAIN_NAME.test(name)) return false;
  return (
    CREDENTIAL_WORDS.has(name) ||
    CREDENTIAL_WORDS.has(name.replace(/[-_]/g, '')) ||
    CREDENTIAL_WORDS.has(name.split(NAME_PARTS).at(-1) ?? '')
  );
}

// `password="…` or `token:'…`: a credential name joined to its value.
const JOINED_CREDENTIAL = /^([\w-]{1,64})[:=]+(.*)$/s;
const QUOTES = new Set(['"', "'"]);

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

/** The safe rendering of a token, or undefined when it must be redacted. */
function renderSafe({ leading, core, trailing, raw }: Token) {
  if (PUNCTUATION_ONLY.test(raw)) return raw;
  if (HTTP_URL.test(core)) {
    const url = toPathOnlyUrl(core);
    return url === REDACTED ? undefined : `${leading}${url}${trailing}`;
  }
  if (
    (WORD.test(core) && core.length <= WORD_MAX) ||
    NUMBER.test(core) ||
    (IDENTIFIER.test(core) && core.length <= IDENTIFIER_MAX)
  )
    return raw;
  return undefined;
}

/**
 * Keeps only safe tokens (words, short numbers, code identifiers,
 * punctuation, path-only http(s) URLs); every other token becomes
 * `[redacted]`, and consecutive ones collapse. The value after a credential
 * word is always redacted unless it is punctuation (one token, or a quoted
 * value up to its closing quote or the end of the line), and a short number
 * next to another number (`555 123 4567`) is redacted with it.
 */
export function redactTelemetryText(value: string): string {
  const parts = value.split(/(\s+)/);
  const tokens: (Token | undefined)[] = [];
  const rendered: (string | undefined)[] = [];
  let quote: string | undefined;
  // Set when the previous token was a credential name, or an auth scheme
  // that was itself a credential's value (`Authorization: bearer x`).
  let credentialNext = false;
  for (let index = 0; index < parts.length; index += 2) {
    const raw = parts[index] ?? '';
    const token = raw ? splitToken(raw) : undefined;
    const afterCredential: boolean = credentialNext;
    credentialNext = false;
    tokens.push(token);
    if (quote && (parts[index - 1] ?? '').includes('\n')) quote = undefined;
    if (!token) {
      rendered.push('');
      continue;
    }
    if (quote) {
      rendered.push(undefined);
      if (raw.includes(quote)) quote = undefined;
      continue;
    }
    const joined = JOINED_CREDENTIAL.exec(token.core);
    if (joined && isCredentialName(joined[1] ?? '')) {
      rendered.push(undefined);
      quote = openedQuote(`${joined[2] ?? ''}${token.trailing}`);
    } else if (afterCredential && !PUNCTUATION_ONLY.test(raw)) {
      rendered.push(undefined);
      quote = openedQuote(raw);
      credentialNext = AUTH_SCHEMES.has(token.core.toLowerCase());
    } else {
      rendered.push(renderSafe(token));
      credentialNext =
        isCredentialName(token.core) ||
        (afterCredential && SEPARATOR_TOKENS.has(raw));
    }
  }
  // A number beside anything else with a digit is part of a longer number.
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token || !NUMBER.test(token.core)) continue;
    const neighbours = [tokens[index - 1], tokens[index + 1]];
    if (neighbours.some((other) => other && HAS_DIGIT.test(other.core)))
      rendered[index] = undefined;
  }
  let output = '';
  for (let index = 0; index < tokens.length; index += 1) {
    const separator = index === 0 ? '' : (parts[index * 2 - 1] ?? '');
    const token = tokens[index];
    const text = rendered[index];
    if (text !== undefined) {
      output += `${separator}${text}`;
      continue;
    }
    // Redacted: collapse into the previous [redacted] if there is one.
    const punctuation = SENTENCE_PUNCTUATION.exec(token?.raw ?? '')?.[0] ?? '';
    const previousRedacted = index > 0 && rendered[index - 1] === undefined;
    if (previousRedacted)
      output = `${output.replace(/[.,;:!?…]*$/, '')}${punctuation}`;
    else output += `${separator}${REDACTED}${punctuation}`;
  }
  return output;
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
