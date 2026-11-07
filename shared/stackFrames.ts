import {
  cutAtLastBreak,
  REDACTED,
  redactTelemetryText,
  SANITIZE_INPUT_FACTOR,
  sanitizePathSegments,
  toPathOnlyUrl,
  TRUNCATED,
  truncateWithMarker,
} from './telemetryRedaction.ts';

/**
 * Stack traces as structured frames, fail-closed: each line must parse as a
 * V8 (`at fn (loc)`, `at loc`) or Firefox/Safari (`fn@loc`) frame and is
 * re-emitted canonically as `    at <fn> (<file>:<line>:<col>)`. Any other
 * line becomes `    [frame omitted]`; the first line, when it is not a
 * frame, is the error name plus a sanitized message.
 */

export const FRAME_OMITTED = '    [frame omitted]';
// A line longer than this is not a frame anyone wrote.
const FRAME_LINE_MAX = 1_000;
const FUNCTION_NAME = /^[\w$.<>[\] ]{1,80}$/;
const LOCATION = /^(.+):(\d{1,9}):(\d{1,9})$/;
// Locations V8 prints without a line and column.
const BARE_LOCATION = /^(?:<anonymous>|native|index \d{1,4})$/;
const URL_PREFIX = /^https?:\/\//i;
// `node:`, `file://`, `webpack-internal:///` or a drive letter, then a path.
const SCHEME_PREFIX = /^[a-z][a-z0-9+.-]*:(?:\/\/\/?)?/i;
const QUERY_START = /[?#]/;
const HEADER = /^([A-Za-z_$][\w$.]{0,63})(?::\s?([\s\S]*))?$/;

/** A frame's file: path-only for http(s), plain path segments otherwise. */
function sanitizeFile(file: string): string {
  if (URL_PREFIX.test(file)) return toPathOnlyUrl(file);
  const query = file.search(QUERY_START);
  const path = query === -1 ? file : file.slice(0, query);
  const scheme = SCHEME_PREFIX.exec(path)?.[0] ?? '';
  const sanitized = sanitizePathSegments(path.slice(scheme.length), /[/\\]/);
  return sanitized.includes(REDACTED) && !sanitized.replace(REDACTED, '')
    ? REDACTED
    : `${scheme}${sanitized}`;
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
  const safeName = FUNCTION_NAME.test(name) ? name : '<anonymous>';
  return `    at ${safeName} (${sanitized})`;
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

function sanitizeHeader(line: string): string {
  const match = HEADER.exec(line);
  if (!match) return redactTelemetryText(line);
  const [, name = '', message] = match;
  return message === undefined
    ? name
    : `${name}: ${redactTelemetryText(message)}`;
}

/**
 * Sanitizes a stack trace into canonical frames, then truncates it at a
 * frame boundary to at most `max` characters, visible marker included. Input past four
 * times `max` is never read, and a frame the bound cut in half is dropped.
 */
export function sanitizeStackTrace(stack: string, max: number): string {
  const bound = max * SANITIZE_INPUT_FACTOR;
  const cut = stack.length > bound;
  const lines = (
    cut
      ? cutAtLastBreak(stack.slice(0, bound), 0, (char) => char === '\n')
      : stack
  ).split('\n');
  const output: string[] = [];
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    const parsed = parseFrame(line);
    if (parsed) output.push(parsed);
    else if (index === 0) output.push(sanitizeHeader(line));
    else if (output.at(-1) !== FRAME_OMITTED) output.push(FRAME_OMITTED);
  }
  const sanitized = output.join('\n');
  if (!cut && sanitized.length <= max) return sanitized;
  const room = max - TRUNCATED.length;
  return truncateWithMarker(
    cutAtLastBreak(sanitized.slice(0, room + 1), 0, (char) => char === '\n'),
    max,
    true,
  );
}
