import {
  cutAtLastBreak,
  hasTooManyDigits,
  isSensitiveToken,
  REDACTED,
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
// at most one `new ` or `async ` prefix and V8's `[as alias]` suffix.
const FUNCTION_NAME =
  /^(?:(?:new|async) )?[A-Za-z_$][\w$.<>]*(?: \[as [A-Za-z_$][\w$]*\])?$/;
const FUNCTION_NAME_MAX = 80;
// Safari's name for top-level script code.
const KNOWN_FUNCTION_NAMES = new Set(['global code']);
const LOCATION = /^(.+):(\d{1,9}):(\d{1,9})$/;
// Locations V8 prints without a line and column.
const BARE_LOCATION = /^(?:<anonymous>|native|index \d{1,4})$/;
const URL_PREFIX = /^https?:\/\//i;
// `node:`, `file://`, `webpack-internal:///` or a drive letter, then a path.
const SCHEME_PREFIX = /^[a-z][a-z0-9+.-]*:(?:\/\/\/?)?/i;
const QUERY_START = /[?#]/;

/** A frame's file: path-only for http(s), plain path segments otherwise. */
function sanitizeFile(file: string): string {
  if (URL_PREFIX.test(file)) return toPathOnlyUrl(file);
  const query = file.search(QUERY_START);
  const path = query === -1 ? file : file.slice(0, query);
  const scheme = SCHEME_PREFIX.exec(path)?.[0] ?? '';
  const sanitized = sanitizePathSegments(path.slice(scheme.length), /[/\\]/);
  return sanitized === REDACTED ? REDACTED : `${scheme}${sanitized}`;
}

function sanitizeLocation(location: string): string | undefined {
  if (BARE_LOCATION.test(location)) return location;
  const match = LOCATION.exec(location);
  if (!match) return undefined;
  const [, file = '', line, column] = match;
  return `${sanitizeFile(file)}:${line}:${column}`;
}

function frame(name: string, location: string): string | undefined {
  const sanitized = sanitizeLocation(location);
  if (sanitized === undefined) return undefined;
  return `    at ${sanitizeFunctionName(name)} (${sanitized})`;
}

/** A frame's function name if it is an identifier shape, else `<anonymous>`. */
function sanitizeFunctionName(name: string): string {
  if (KNOWN_FUNCTION_NAMES.has(name)) return name;
  // `isSensitiveToken` finds a key in any dotted part or `[as alias]`.
  return name.length <= FUNCTION_NAME_MAX &&
    FUNCTION_NAME.test(name) &&
    !hasTooManyDigits(name) &&
    !isSensitiveToken(name)
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
 * error name alone (`TypeError`), or `[redacted]` if that is not an error
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
    else if (index === 0) output.push(REDACTED);
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
