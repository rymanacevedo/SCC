import { ASSET_PATH, withoutAssetHash } from './reportAssets.ts';
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
 * Stack traces as structured frames, closed-world: nothing the browser can
 * choose is kept. Each line must parse as a V8 (`at fn (loc)`, `at loc`) or
 * Firefox/Safari (`fn@loc`) frame and is re-emitted canonically as
 * `    at <anonymous> (<file>:<line>:<col>)`: the function name is always
 * dropped, the file is one the app ships or `https://app.invalid/[redacted]`,
 * and the line and column are bounded numbers. Any other line becomes
 * `    [frame omitted]`. The first line, when it is not a frame, is reduced
 * to the error name: its message is free text, never kept.
 */

/** What the Worker knows that the browser does not. */
export type StackSanitizeOptions = {
  /**
   * The asset paths the client build published (`report-assets.json`).
   * When given, an asset file is kept only if it is in the set; the browser
   * pass has no set and checks the asset's shape instead.
   */
  knownAssets?: ReadonlySet<string>;
};

const FRAME_OMITTED = '    [frame omitted]';
// A line longer than this is not a frame anyone wrote.
const FRAME_LINE_MAX = 1_000;
const LOCATION = /^(.+):(\d{1,9}):(\d{1,9})$/;
// The largest bundle is about 417 KB on one minified line: a real column
// has at most 6 digits, a real line at most 5. A frame past either is omitted.
const LINE_DIGITS_MAX = 5;
const COLUMN_DIGITS_MAX = 6;
// Locations V8 prints without a line and column.
const BARE_LOCATION = /^(?:<anonymous>|native|index \d{1,4})$/;
const HTTP_SCHEME = /^https?:\/\//i;
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
  'cluster',
  'console',
  'crypto',
  'dgram',
  'diagnostics_channel',
  'dns',
  'domain',
  'events',
  'fs',
  'http',
  'http2',
  'https',
  'inspector',
  'internal',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'timers',
  'tls',
  'trace_events',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'wasi',
  'worker_threads',
  'zlib',
]);
// What any other file becomes: the frame keeps its position.
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
 * A frame's file, reduced to what the app ships: a Vite bundle asset
 * (`/assets/<name>-<hash>.js`, under the synthetic origin) or a known Node.js
 * built-in module (`node:fs`). With `knownAssets` (the Worker), an asset is
 * kept only if the build published it; without (the browser), only if its
 * name passes the identifier rule. Any other file (a dev module path, an
 * extension, `blob:`, `file:`, `webpack:`, a path of words) becomes
 * `https://app.invalid/[redacted]`, and the frame is kept.
 */
function sanitizeFile(file: string, knownAssets?: ReadonlySet<string>): string {
  const node = NODE_MODULE.exec(file)?.[1];
  if (node !== undefined)
    return NODE_BUILTIN_MODULES.has(node) ? `node:${node}` : FILE_REDACTED;
  const path = filePath(file);
  const name = path === undefined ? undefined : ASSET_PATH.exec(path)?.[1];
  if (path === undefined || name === undefined) return FILE_REDACTED;
  const kept = knownAssets ? knownAssets.has(path) : isSafeAssetName(name);
  return kept ? `${REPORT_ORIGIN}${path}` : FILE_REDACTED;
}

/** The browser's check: no key, at most 4 digits, every part a word. */
function isSafeAssetName(name: string): boolean {
  return (
    !isSensitiveToken(name) &&
    !hasTooManyDigits(name) &&
    name
      .split(ASSET_NAME_SEPARATORS)
      .filter(Boolean)
      .every(isSafeIdentifierPart)
  );
}

function sanitizeLocation(
  location: string,
  knownAssets?: ReadonlySet<string>,
): string | undefined {
  if (BARE_LOCATION.test(location)) return location;
  const match = LOCATION.exec(location);
  if (!match) return undefined;
  const [, file = '', line = '', column = ''] = match;
  if (line.length > LINE_DIGITS_MAX || column.length > COLUMN_DIGITS_MAX)
    return undefined;
  return `${sanitizeFile(file, knownAssets)}:${line}:${column}`;
}

// Every frame starts so: the function name is never kept, since the
// browser can choose it (`password_correcthorse`).
const FRAME_START = '    at <anonymous> (';

function frame(
  location: string,
  knownAssets?: ReadonlySet<string>,
): string | undefined {
  const sanitized = sanitizeLocation(location, knownAssets);
  return sanitized === undefined ? undefined : `${FRAME_START}${sanitized})`;
}

/**
 * One stack line as a canonical frame, or undefined if it is not one. The
 * function name only locates the location; it is never kept.
 */
function parseFrame(
  line: string,
  knownAssets?: ReadonlySet<string>,
): string | undefined {
  const trimmed = line.trim();
  if (trimmed.length > FRAME_LINE_MAX) return undefined;
  if (trimmed.startsWith('at ')) {
    const body = trimmed.slice(3);
    if (body.endsWith(')')) {
      const open = body.lastIndexOf(' (');
      if (open !== -1) return frame(body.slice(open + 2, -1), knownAssets);
    }
    return frame(body, knownAssets);
  }
  const at = trimmed.indexOf('@');
  if (at === -1) return undefined;
  return frame(trimmed.slice(at + 1), knownAssets);
}

// The first line of a V8 stack, `Name: message` or a bare `Name`: only the
// name is kept. An identifier then `:` or the end of the line, which no
// frame line starts with (`at …`, `fn@…`, `global code@…`).
const HEADER = /^\s*([A-Za-z_$][\w$.]*)(?::|\s*$)/;

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
export function sanitizeStackTrace(
  stack: string,
  max: number,
  { knownAssets }: StackSanitizeOptions = {},
): string {
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
    const parsed =
      header === undefined ? parseFrame(line, knownAssets) : undefined;
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

// A canonical frame's file: the frame start, the file, its coordinates.
const FRAME_FILE = /^ {4}at <anonymous> \((.*?)(?::\d+:\d+)?\)$/;

/**
 * A canonical frame's file, without its line and column and with an asset's
 * content hash replaced (`https://app.invalid/assets/main-[hash].js`), so a
 * new build of the same code reads the same. A bare location (`native`)
 * stays as it is.
 */
function frameFile(frame: string): string | undefined {
  const file = FRAME_FILE.exec(frame)?.[1];
  if (file === undefined) return undefined;
  return file.startsWith(`${REPORT_ORIGIN}/`)
    ? `${REPORT_ORIGIN}${withoutAssetHash(file.slice(REPORT_ORIGIN.length))}`
    : file;
}

/**
 * The error name and the files of the first `frameCount` frames of a
 * sanitized stack: what an issue title and the telemetry fingerprint are
 * built from.
 */
export function stackSummary(sanitizedStack: string, frameCount: number) {
  const lines = sanitizedStack.split('\n');
  const header = lines[0] ?? '';
  return {
    name: header && !header.startsWith('    ') ? header : '',
    files: lines
      .map(frameFile)
      .filter((file) => file !== undefined)
      .slice(0, frameCount),
  };
}
