import { expect, test } from 'bun:test';
import { TRUNCATED } from '../../shared/telemetryRedaction.ts';
import {
  expectNoSensitiveValues,
  SENSITIVE_AKIA_NAME,
  SENSITIVE_AT_HEADER_STACK,
  SENSITIVE_KEY_ERROR_NAME,
  SENSITIVE_KEY_URL,
  SENSITIVE_NAMED_STACK,
  SENSITIVE_PLACEHOLDER_MESSAGE,
  SENSITIVE_MESSAGE,
  SENSITIVE_PAREN_URL,
  SENSITIVE_STACK,
  SENSITIVE_URL,
} from '../../test/sensitive-reports.ts';
import {
  describeErrorForLog,
  logToken,
  redactUrlForLog,
  timestampForLog,
} from './log.ts';

test('a thrown value that is not an Error is logged only by its type', () => {
  for (const [thrown, type] of [
    [`${SENSITIVE_MESSAGE} ${SENSITIVE_URL}`, 'string'],
    [{ email: 'jane.doe@example.com' }, 'object'],
    [Object.create(null), 'object'],
    [['jane.doe@example.com'], 'array'],
    [null, 'null'],
    [undefined, 'undefined'],
    [5551234567, 'number'],
  ] as const)
    expect(describeErrorForLog(thrown)).toEqual({
      message: `[thrown ${type} omitted]`,
    });
});

test('a log string is kept only as a short machine token', () => {
  for (const token of ['github', 'openai', 'maxRetriesExceeded', 'abort'])
    expect(logToken(token)).toBe(token);
  expect(logToken('Bad credentials for jane.doe@example.com')).toBe(
    '[text omitted: 40 characters]',
  );
  expect(logToken('hunter2')).toBe('[text omitted: 7 characters]');
});

test('non-string values pass through the log helpers unchanged', () => {
  for (const value of [undefined, null, 401, true]) {
    expect(logToken(value)).toBe(value);
    expect(redactUrlForLog(value)).toBe(value);
    expect(timestampForLog(value)).toBe(value);
  }
});

test('an Error is logged as its class name, frames, cause class and message length', () => {
  const cause = new TypeError(`GET ${SENSITIVE_PAREN_URL} phone:5557654321`);
  const error = new Error(SENSITIVE_MESSAGE, { cause });
  error.stack = SENSITIVE_STACK;
  const described = describeErrorForLog(error);
  expectNoSensitiveValues(JSON.stringify(described));
  expect(described).toEqual({
    name: 'Error',
    message: `[message omitted: ${SENSITIVE_MESSAGE.length} characters]`,
    causeName: 'TypeError',
    stack: [
      'TypeError',
      '    at saveSummary (https://app.invalid/assets/main-abcdef12.js:12:34)',
      '    [frame omitted]',
      '    at retry (https://app.invalid/assets/api-1a2b3c4d.js:9:9)',
      '    at loadPage (https://app.invalid/assets/page.js:3:4)',
      '    [frame omitted]',
      '    at fn (https://app.invalid/a(b).js:7:8)',
      '    at dial (https://app.invalid/call/[redacted]/a.js:9:9)',
      '    at <anonymous> (https://app.invalid/reset/[redacted]/a.js:1:2)',
      '    at keyed (https://app.invalid/k/[redacted]/a.js:1:2)',
      '    at <anonymous> (https://app.invalid/k/[redacted]/a.js:1:2)',
      '    at <anonymous> (https://app.invalid/k/[redacted]/a.js:3:4)',
      '    at <anonymous> (https://app.invalid/k/[redacted]:5:6)',
      '    at <anonymous> (https://app.invalid/a.js:2:2)',
      '    at <anonymous> (https://app.invalid/a.js:2:3)',
      '    [frame omitted]',
      '    at load (blob:https://app.invalid/token.js:2:5)',
      '    at <anonymous> (https://app.invalid/a.js:3:1)',
      '    at <anonymous> (https://app.invalid/a.js:3:2)',
      '    at eval (https://app.invalid/script.js:3:3)',
      '    [frame omitted]',
    ].join('\n'),
  });
});

test('an error name or stack header that is not a known error class is Error', () => {
  const error = new Error('Broken');
  error.name = 'hunter2';
  error.stack =
    'apiKey: headersecretvalue\n    at f (https://scc.example/a.js:1:2)';
  const described = describeErrorForLog(error);
  expectNoSensitiveValues(JSON.stringify(described));
  expect(described).toMatchObject({
    name: 'Error',
    stack: 'Error\n    at f (https://app.invalid/a.js:1:2)',
  });
});

test('a key-bearing Error.name, cause.name or header is logged as Error', () => {
  const cause = new Error('x');
  cause.name = SENSITIVE_AKIA_NAME;
  const error = new Error('x', { cause });
  error.name = SENSITIVE_KEY_ERROR_NAME;
  error.stack = SENSITIVE_NAMED_STACK;
  const described = describeErrorForLog(error);
  expectNoSensitiveValues(JSON.stringify(described));
  expect(described).toMatchObject({
    name: 'Error',
    causeName: 'Error',
    stack: 'Error\n    at save (https://app.invalid/a.js:1:2)',
  });
});

test('a placeholder-shaped message with a crafted label is logged by its length', () => {
  const described = describeErrorForLog(
    new Error(SENSITIVE_PLACEHOLDER_MESSAGE),
  );
  expectNoSensitiveValues(JSON.stringify(described));
  expect(described.message).toBe(
    `[message omitted: ${SENSITIVE_PLACEHOLDER_MESSAGE.length} characters]`,
  );
});

test('a header ending like a frame location is logged as the error name', () => {
  const error = new Error('x');
  error.stack = SENSITIVE_AT_HEADER_STACK;
  const described = describeErrorForLog(error);
  expectNoSensitiveValues(JSON.stringify(described));
  expect(described.stack).toBe(
    'Error\n    at save (https://app.invalid/a.js:1:2)',
  );
});

test('a key in a logged URL is redacted however it is wrapped', () => {
  expect(redactUrlForLog(SENSITIVE_KEY_URL)).toBe(
    'https://app.invalid/k/[redacted]/[redacted]/[redacted]',
  );
});

test('a logged stack is capped at 4,000 characters with a marker', () => {
  const error = new Error('Broken');
  error.stack = `Error: Broken\n${'    at frame (https://scc.example/a.js:1:2)\n'.repeat(500)}`;
  const { stack } = describeErrorForLog(error) as { stack: string };
  // Cut at the last whole frame inside 4,000 characters.
  expect(stack.endsWith(`(https://app.invalid/a.js:1:2)\n${TRUNCATED}`)).toBe(
    true,
  );
  expect(stack.length).toBeLessThanOrEqual(4_000);
  expect(stack.length).toBeGreaterThan(3_900);
});
