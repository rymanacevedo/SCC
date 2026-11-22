import { withoutAssetHash } from './reportAssets.ts';
import {
  cutAtLastBreak,
  markTruncated,
  REDACTED,
  REPORT_ORIGIN,
  SANITIZE_INPUT_FACTOR,
  sanitizeErrorName,
  TRUNCATED,
} from './telemetryRedaction.ts';

export type StackSanitizeOptions = {
  knownAssets: ReadonlySet<string>;
};

const FRAME_OMITTED = '    [frame omitted]';
const FRAME_LINE_MAX = 1_000;
const LOCATION = /^(.+):(\d{1,9}):(\d{1,9})$/;
const LINE_DIGITS_MAX = 5;
const COLUMN_DIGITS_MAX = 6;
const BARE_LOCATION = /^(?:<anonymous>|native|index \d{1,4})$/;
const HTTP_SCHEME = /^https?:\/\//i;
const NODE_MODULE = /^node:([a-z_]{1,24})(?![^/])/;
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
const FILE_REDACTED = `${REPORT_ORIGIN}/${REDACTED}`;

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

function sanitizeFile(file: string, knownAssets: ReadonlySet<string>): string {
  const node = NODE_MODULE.exec(file)?.[1];
  if (node !== undefined)
    return NODE_BUILTIN_MODULES.has(node) ? `node:${node}` : FILE_REDACTED;
  const path = filePath(file);
  return path !== undefined && knownAssets.has(path)
    ? `${REPORT_ORIGIN}${path}`
    : FILE_REDACTED;
}

function sanitizeLocation(
  location: string,
  knownAssets: ReadonlySet<string>,
): string | undefined {
  if (BARE_LOCATION.test(location)) return location;
  const match = LOCATION.exec(location);
  if (!match) return undefined;
  const [, file = '', line = '', column = ''] = match;
  if (line.length > LINE_DIGITS_MAX || column.length > COLUMN_DIGITS_MAX)
    return undefined;
  return `${sanitizeFile(file, knownAssets)}:${line}:${column}`;
}

const FRAME_START = '    at <anonymous> (';

function frame(
  location: string,
  knownAssets: ReadonlySet<string>,
): string | undefined {
  const sanitized = sanitizeLocation(location, knownAssets);
  return sanitized === undefined ? undefined : `${FRAME_START}${sanitized})`;
}

function parseFrame(
  line: string,
  knownAssets: ReadonlySet<string>,
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

const HEADER = /^\s*([A-Za-z_$][\w$.]*)(?::|\s*$)/;

export function sanitizeStackTrace(
  stack: string,
  max: number,
  { knownAssets }: StackSanitizeOptions,
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
  return markTruncated(
    cutAtLastBreak(`${sanitized}\n`.slice(0, room + 1), isLineBreak),
    max,
  );
}

export function stackWithHeader(
  name: string,
  stack: string | undefined,
): string {
  if (!stack) return name;
  const firstLine = stack.split('\n', 1)[0] ?? '';
  return HEADER.test(firstLine) ? stack : `${name}\n${stack}`;
}

const FRAME_FILE = /^ {4}at <anonymous> \((.*?)(?::\d+:\d+)?\)$/;

function frameFile(frame: string): string | undefined {
  const file = FRAME_FILE.exec(frame)?.[1];
  if (file === undefined) return undefined;
  return file.startsWith(`${REPORT_ORIGIN}/`)
    ? `${REPORT_ORIGIN}${withoutAssetHash(file.slice(REPORT_ORIGIN.length))}`
    : file;
}

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
