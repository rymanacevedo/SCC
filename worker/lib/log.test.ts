import { expect, test } from 'bun:test';
import { TRUNCATED } from '../../shared/telemetryRedaction.ts';
import {
  expectNoSensitiveValues,
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
      '    at saveSummary (https://scc.example/assets/main-abcdef12.js:12:34)',
      '    [frame omitted]',
      '    at retry (https://scc.example/assets/api-1a2b3c4d.js:9:9)',
      '    at loadPage (https://scc.example/assets/page.js:3:4)',
      '    [frame omitted]',
      '    at fn (https://scc.example/a(b).js:7:8)',
      '    at dial (https://scc.example/call/[redacted]/a.js:9:9)',
      '    at <anonymous> (https://scc.example/reset/[redacted]/a.js:1:2)',
      '    at keyed (https://scc.example/k/[redacted]/a.js:1:2)',
    ].join('\n'),
  });
});

test('an error name or stack header that is not an error class is [redacted]', () => {
  const error = new Error('Broken');
  error.name = 'hunter2';
  error.stack =
    'apiKey: headersecretvalue\n    at f (https://scc.example/a.js:1:2)';
  const described = describeErrorForLog(error);
  expectNoSensitiveValues(JSON.stringify(described));
  expect(described).toMatchObject({
    name: '[redacted]',
    stack: '[redacted]\n    at f (https://scc.example/a.js:1:2)',
  });
});

test('a logged stack is capped at 4,000 characters with a marker', () => {
  const error = new Error('Broken');
  error.stack = `Error: Broken\n${'    at frame (https://scc.example/a.js:1:2)\n'.repeat(500)}`;
  const { stack } = describeErrorForLog(error) as { stack: string };
  // Cut at the last whole frame inside 4,000 characters.
  expect(stack.endsWith(`(https://scc.example/a.js:1:2)\n${TRUNCATED}`)).toBe(
    true,
  );
  expect(stack.length).toBeLessThanOrEqual(4_000);
  expect(stack.length).toBeGreaterThan(3_900);
});
