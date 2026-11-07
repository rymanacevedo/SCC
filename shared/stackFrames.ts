import {
  cutAtLastBreak,
  hasTooManyDigits,
  isSafeIdentifierPart,
  isSensitiveToken,
  REDACTED,
  REPORT_ORIGIN,
  SANITIZE_INPUT_FACTOR,
  sanitizeErrorName,
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
const HTTP_SCHEME = /^https?:\/\//i;
// The app's own bundle files, as Vite names them: `/assets/<name>-<hash>.js`
// with an 8-character base64url content hash (`/assets/entry.client-BUZPaea6.js`,
// `/assets/education-BL-Djl3_.js`). The name's parts pass the identifier rule.
const ASSET_PATH =
  /^\/assets\/([A-Za-z][\w.-]{0,47})-[\w-]{8}\.(?:js|mjs|css)$/;
const ASSET_NAME_SEPARATORS = /[.-]+/;
// A Node.js location (`node:fs`, `node:internal/vm`): its first segment.
const NODE_MODULE = /^node:([a-z_]{1,24})(?![^/])/;
// The Node.js built-in modules a frame may name, plus `internal`. A fixed
// list, so the browser cannot put a word or a key-shaped value of its own
// (`node:sk_live_…`) into an issue. Checked against Node's own list by a test.
export const NODE_BUILTIN_MODULES: ReadonlySet<string> = new Set([
  'assert',
  'async_hooks',
  'buffer',
  'child_process',
  'crypto',
  'dns',
  'events',
  'fs',
  'http',
  'https',
  'internal',
  'module',
  'net',
  'os',
  'path',
  'process',
  'querystring',
  'readline',
  'stream',
  'string_decoder',
  'timers',
  'tls',
  'url',
  'util',
  'vm',
  'worker_threads',
  'zlib',
]);
// What any other file becomes: the frame keeps its function and position.
const FILE_REDACTED = `${REPORT_ORIGIN}/${REDACTED}`;

/** The path of a root-relative or http(s) file reference, if it has one. */
function filePath(file: string): string | undefined {
  if (file.startsWith('/') && !file.startsWith('//'))
    return file.split(/[?#]/, 1)[0];
  if (!HTTP_SCHEME.test(file)) return undefined;
  try {
    return new URL(file).pathname;
  } catch {
    return undefined;
  }
}

/**
 * A frame's file, reduced to the shapes the app's own code runs from: a
 * Vite bundle asset (`/assets/<name>-<hash>.js`, under the synthetic origin)
 * or a known Node.js built-in module (`node:fs`). Any other file (a dev module
 * path, an extension, `blob:`, `file:`, `webpack:`, a path of words) becomes
 * `https://app.invalid/[redacted]`, and the frame is kept: the browser does
 * not choose the words a file path carries into an issue.
 */
function sanitizeFile(file: string): string {
  const node = NODE_MODULE.exec(file)?.[1];
  if (node !== undefined)
    return NODE_BUILTIN_MODULES.has(node) ? `node:${node}` : FILE_REDACTED;
  const path = filePath(file);
  const name = path === undefined ? undefined : ASSET_PATH.exec(path)?.[1];
  return name !== undefined &&
    !isSensitiveToken(name) &&
    name
      .split(ASSET_NAME_SEPARATORS)
      .filter(Boolean)
      .every(isSafeIdentifierPart)
    ? `${REPORT_ORIGIN}${path}`
    : FILE_REDACTED;
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

/**
 * A frame's function name if it is an identifier shape whose every dotted
 * part and `[as alias]` passes the identifier rule
 * (`isSafeIdentifierPart`), and the whole name, alias included, stays under
 * its digit cap, else `<anonymous>`. `renderSummary`,
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
 * bound cut in half is dropped. A trailing truncation marker, as a first
 * pass leaves it, is kept, so a second pass does not hide that frames were
 * cut.
 */
export function sanitizeStackTrace(stack: string, max: number): string {
  const bound = max * SANITIZE_INPUT_FACTOR;
  const cut = stack.length > bound;
  const isLineBreak = (char: string) => char === '\n';
  const lines = (
    cut ? cutAtLastBreak(stack.slice(0, bound), isLineBreak) : stack
  ).split('\n');
  const marked = lines.length > 1 && lines.at(-1) === TRUNCATED;
  if (marked) lines.pop();
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
  if (!cut && !marked && sanitized.length <= max) return sanitized;
  const room = max - TRUNCATED.length;
  return truncateWithMarker(
    cutAtLastBreak(`${sanitized}\n`.slice(0, room + 1), isLineBreak),
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
