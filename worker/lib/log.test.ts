import { expect, test } from 'bun:test';
import { TRUNCATED } from '../../shared/telemetryRedaction.ts';
import {
  expectNoSensitiveValues,
  SENSITIVE_PAREN_URL,
  SENSITIVE_STACK,
  SENSITIVE_MESSAGE,
  SENSITIVE_URL,
} from '../../test/sensitive-reports.ts';
import { describeErrorForLog, redactForLog, redactUrlForLog } from './log.ts';

test('a thrown value that is not an Error is logged as redacted text only', () => {
  expect(describeErrorForLog(`${SENSITIVE_MESSAGE} ${SENSITIVE_URL}`)).toEqual({
    message:
      'Save failed for [redacted], call [redacted] https://scc.example/summary',
  });
  expect(describeErrorForLog({ email: 'jane.doe@example.com' })).toEqual({
    message: '[object Object]',
  });
  expect(describeErrorForLog(undefined)).toEqual({ message: 'undefined' });
});

test('non-string values pass through the text and URL redactors unchanged', () => {
  for (const value of [undefined, null, 401, true]) {
    expect(redactForLog(value)).toBe(value);
    expect(redactUrlForLog(value)).toBe(value);
  }
});

test('an Error is logged with redacted name, message, cause and stack', () => {
  const error = new Error(SENSITIVE_MESSAGE, {
    cause: new Error(`GET ${SENSITIVE_PAREN_URL} phone:5557654321`),
  });
  error.stack = SENSITIVE_STACK;
  const described = describeErrorForLog(error);
  expectNoSensitiveValues(JSON.stringify(described));
  expect(described).toMatchObject({
    name: 'Error',
    message: 'Save failed for [redacted], call [redacted]',
    causeMessage: 'GET https://scc.example/a(b) [redacted]',
  });
  expect(described.stack).toBe(
    [
      'TypeError: Save failed',
      '    at saveSummary (https://scc.example/assets/main-abcdef12.js:12:34)',
      '    [frame omitted]',
      '    at retry (https://scc.example/assets/api-1a2b3c4d.js:9:9)',
      '    at loadPage (https://scc.example/assets/page.js:3:4)',
      '    [frame omitted]',
      '    at fn (https://scc.example/a(b).js:7:8)',
    ].join('\n'),
  );
});

test('a logged stack is capped at 4,000 characters with a marker', () => {
  const error = new Error('Broken');
  error.stack = `Error: Broken\n${'    at frame (https://scc.example/a.js:1:2)\n'.repeat(500)}`;
  const { stack } = describeErrorForLog(error) as { stack: string };
  // Cut at the last whole frame inside 4,000 characters.
  expect(stack.endsWith(`(https://scc.example/a.js:1:2)\n${TRUNCATED}`)).toBe(
    true,
  );
  expect(stack.length).toBeLessThanOrEqual(4_000 + TRUNCATED.length);
  expect(stack.length).toBeGreaterThan(3_900);
  const short = new Error('Broken');
  short.stack = 'Error: Broken\n    at frame (https://scc.example/a.js:1:2)';
  expect(describeErrorForLog(short)).toMatchObject({ stack: short.stack });
});
