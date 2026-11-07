import {
  cutAtLastBreak,
  hasTooManyDigits,
  isSafeIdentifierPart,
  isSensitiveToken,
  REPORT_ORIGIN,
  SANITIZE_INPUT_FACTOR,
  sanitizeErrorName,
  sanitizePathSegments,
  toPathOnlyUrl,
  TRUNCATED,
  truncateWithMarker,
} from './telemetryRedaction.ts';

/**
 * Stack traces as structured frames, fail-closed: each line must parse as a
 * V8 (`at fn (loc)`, `at loc`) or Firefox/Safari (`fn@loc`) frame and is
 * re-emitted canonically as `    at <fn> (<file>:<line>:<col>)`. Any other
 * line becomes `    [frame omitted]`. The first line, when it is not a frame,
 * is reduced to the error name: its message is free text, never kept.
 */

const FRAME_OMITTED = '    [frame omitted]';
// A line longer than this is not a frame anyone wrote.
const FRAME_LINE_MAX = 1_000;
// An identifier (`saveSummary`, `Array.map`, `Object.<anonymous>`), with
// at most one `new ` or `async ` prefix and V8's `[as alias]` suffix; the
// groups are the dotted name and the alias.
const FUNCTION_NAME =
  /^(?:(?:new|async) )?([A-Za-z_$][\w$.<>]*)(?: \[as ([A-Za-z_$][\w$]*)\])?$/;
const FUNCTION_NAME_MAX = 80;
const ANGLE_BRACKETS = /[<>]/g;
// Safari's name for top-level script code.
const KNOWN_FUNCTION_NAMES = new Set(['global code']);
const LOCATION = /^(.+):(\d{1,9}):(\d{1,9})$/;
// Locations V8 prints without a line and column.
const BARE_LOCATION = /^(?:<anonymous>|native|index \d{1,4})$/;
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const HTTP_SCHEME = /^https?:/i;
// `//host/…` (V8 prints eval'd code this way) or a `\\host\…` share: the
// first segment is an authority, never a path segment.
const NETWORK_PATH = /^(?:\/\/|\\\\)/;
const QUERY_START = /[?#]/;
// Schemes whose URL has a host: it is replaced by the synthetic one.
const HOSTED_SCHEMES = new Set([
  'chrome-extension',
  'file',
  'moz-extension',
  'safari-extension',
  'webpack',
  'webpack-internal',
]);
const SYNTHETIC_HOST = new URL(REPORT_ORIGIN).host;

/** A path, query and fragment dropped, with only its plain segments. */
function sanitizePath(path: string, separator: RegExp): string {
  const query = path.search(QUERY_START);
  return sanitizePathSegments(
    query === -1 ? path : path.slice(0, query),
    separator,
  );
}

/**
 * A frame's file under a fixed scheme allowlist: a plain path; `http(s)`
 * under the synthetic origin; `blob:` around such a URL; `node:` and a
 * path; or a hosted scheme (`webpack:`, `file:`, `chrome-extension:`, …)
 * written with `//`, its host replaced by the synthetic one. An authority
 * is never read as a path segment: a `//host/…` reference goes under the
 * synthetic origin, and a nested URL in any scheme but `blob:` (or a hosted
 * scheme without `//`) is undefined. So is any other scheme. Undefined
 * omits the frame, since dropping only the scheme would leave what followed
 * it to be read as a path.
 */
function sanitizeFile(file: string): string | undefined {
  if (NETWORK_PATH.test(file))
    return toPathOnlyUrl(`https:${file.replace(/\\/g, '/')}`);
  const scheme = SCHEME.exec(file)?.[1]?.toLowerCase();
  if (scheme === undefined) return sanitizePath(file, /[/\\]/);
  const rest = file.slice(scheme.length + 1);
  if (scheme === 'http' || scheme === 'https') return toPathOnlyUrl(file);
  if (scheme === 'blob')
    return HTTP_SCHEME.test(rest) ? `blob:${toPathOnlyUrl(rest)}` : undefined;
  // `node:https://host/…`, `webpack:https://host/…`: a nested URL.
  if (SCHEME.test(rest.replace(/^\/+/, ''))) return undefined;
  // `node:fs`, `node:internal/vm`; `node://host/…` would read its host as a
  // path, so an authority omits the frame.
  if (scheme === 'node')
    return rest.startsWith('//')
      ? undefined
      : `node:${sanitizePath(rest, /\//)}`;
  if (!HOSTED_SCHEMES.has(scheme) || !rest.startsWith('//')) return undefined;
  let url: URL;
  try {
    url = new URL(file);
  } catch {
    return undefined;
  }
  const host = url.host ? SYNTHETIC_HOST : '';
  return `${scheme}://${host}${sanitizePathSegments(url.pathname, /\//)}`;
}

function sanitizeLocation(location: string): string | undefined {
  if (BARE_LOCATION.test(location)) return location;
  const match = LOCATION.exec(location);
  if (!match) return undefined;
  const [, file = '', line, column] = match;
  const sanitized = sanitizeFile(file);
  return sanitized === undefined ? undefined : `${sanitized}:${line}:${column}`;
}

function frame(name: string, location: string): string | undefined {
  const sanitized = sanitizeLocation(location);
  if (sanitized === undefined) return undefined;
  return `    at ${sanitizeFunctionName(name)} (${sanitized})`;
}

/**
 * A frame's function name if it is an identifier shape whose every dotted
 * part and `[as alias]` passes the rule path segments use
 * (`isSafeIdentifierPart`), and the whole name, alias included, stays under
 * the same digit cap a segment has, else `<anonymous>`. `renderSummary`,
 * `Array.map`, `Object.<anonymous>`, `async loadUser` and `new Foo` stay;
 * `Object.555.123.4567` does not.
 */
function sanitizeFunctionName(name: string): string {
  if (KNOWN_FUNCTION_NAMES.has(name)) return name;
  const match = name.length <= FUNCTION_NAME_MAX && FUNCTION_NAME.exec(name);
  if (!match || isSensitiveToken(name) || hasTooManyDigits(name))
    return '<anonymous>';
  const [, dotted = '', alias] = match;
  const parts = [...dotted.replace(ANGLE_BRACKETS, '').split('.'), alias ?? ''];
  return parts.every((part) => !part || isSafeIdentifierPart(part))
    ? name
    : '<anonymous>';
}

/** One stack line as a canonical frame, or undefined if it is not one. */
function parseFrame(line: string): string | undefined {
  const trimmed = line.trim();
  if (trimmed.length > FRAME_LINE_MAX) return undefined;
  if (trimmed.startsWith('at ')) {
    const body = trimmed.slice(3);
    if (body.endsWith(')')) {
      const open = body.lastIndexOf(' (');
      if (open !== -1)
        return frame(body.slice(0, open), body.slice(open + 2, -1));
    }
    return frame('', body);
  }
  const at = trimmed.indexOf('@');
  if (at === -1) return undefined;
  return frame(trimmed.slice(0, at), trimmed.slice(at + 1));
}

// The first line of a V8 stack, `Name: message` or a bare `Name`: only the
// name is kept. An identifier then `:` or the end of the line, which no
// frame line starts with (`at …`, `fn@…`, `global code@…`).
const HEADER = /^\s*([A-Za-z_$][\w$.]*)(?::|\s*$)/;
const FRAME_PREFIX = '    at ';

/**
 * Sanitizes a stack trace into canonical frames, then truncates it at a
 * frame boundary to at most `max` characters, visible marker included.
 * The first line is read as `Name: message` before it is tried as a frame,
 * so `Error: …@host:1:2` is not taken for a Firefox frame; it becomes the
 * error name alone (`TypeError`), or `Error` if that is not a known error
 * class name. Input past four times `max` is never read, and a frame the
 * bound cut in half is dropped.
 */
export function sanitizeStackTrace(stack: string, max: number): string {
  const bound = max * SANITIZE_INPUT_FACTOR;
  const cut = stack.length > bound;
  const isLineBreak = (char: string) => char === '\n';
  const lines = (
    cut ? cutAtLastBreak(stack.slice(0, bound), isLineBreak) : stack
  ).split('\n');
  const output: string[] = [];
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    const header = index === 0 ? HEADER.exec(line)?.[1] : undefined;
    const parsed = header === undefined ? parseFrame(line) : undefined;
    if (header !== undefined) output.push(sanitizeErrorName(header));
    else if (parsed) output.push(parsed);
    else if (index === 0) output.push(sanitizeErrorName(''));
    else if (output.at(-1) !== FRAME_OMITTED) output.push(FRAME_OMITTED);
  }
  const sanitized = output.join('\n');
  if (!cut && sanitized.length <= max) return sanitized;
  const room = max - TRUNCATED.length;
  return truncateWithMarker(
    cutAtLastBreak(sanitized.slice(0, room + 1), isLineBreak),
    max,
    true,
  );
}

/**
 * A stack whose first line is the error's header. V8 starts with
 * `Name: message`; Firefox and Safari start with a frame, so the error's
 * class name is put first. The title and fingerprint then read the name the
 * same way whatever the browser. With no stack, the name alone.
 */
export function stackWithHeader(
  name: string,
  stack: string | undefined,
): string {
  if (!stack) return name;
  const firstLine = stack.split('\n', 1)[0] ?? '';
  return HEADER.test(firstLine) ? stack : `${name}\n${stack}`;
}

/**
 * The error name and the first `frameCount` frames of a sanitized stack:
 * what an issue title and the telemetry fingerprint are built from.
 */
export function stackSummary(sanitizedStack: string, frameCount: number) {
  const lines = sanitizedStack.split('\n');
  const header = lines[0] ?? '';
  return {
    name: header && !header.startsWith('    ') ? header : '',
    frames: lines
      .filter((line) => line.startsWith(FRAME_PREFIX))
      .slice(0, frameCount),
  };
}
