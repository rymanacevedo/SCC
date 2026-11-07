import { afterEach, expect, test } from 'bun:test';
import {
  errorTelemetrySchema,
  REPORT_FIELD_LIMITS,
  resetReportedTelemetryForTests,
} from '../shared/errorReporting.ts';
import { captureFetchBodies } from '../test/capture-fetch.ts';
import {
  expectNoSensitiveValuesOnTheWire,
  SENSITIVE_MESSAGE,
  SENSITIVE_STACK,
  SENSITIVE_URL,
} from '../test/sensitive-reports.ts';
import { reportErrorTelemetry } from './error-reporting.ts';

const original = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = original;
  resetReportedTelemetryForTests();
});
test('auto-report allowlists telemetry fields, dedupes and ignores 404 Responses', async () => {
  const bodies = captureFetchBodies();
  const error = Object.assign(new Error('Page failed'), {
    user: { name: 'Private' },
  });
  await reportErrorTelemetry(error, 'https://scc.example/info');
  await reportErrorTelemetry(error, 'https://scc.example/info');
  await reportErrorTelemetry(new Response(null, { status: 404 }));
  expect(bodies).toHaveLength(1);
  expect(JSON.parse(bodies[0] ?? '{}')).toEqual({
    url: 'https://app.invalid/info',
    message: `[message omitted: ${error.message.length} characters]`,
    // A real stack, as canonical frames; a source path is not a bundle
    // asset, so it is redacted.
    stackTrace: expect.stringMatching(
      /^Error\n    at <anonymous> \(https:\/\/app\.invalid\/\[redacted\]:\d+:\d+\)/,
    ),
    timestamp: expect.any(String),
  });
  expect(JSON.stringify(bodies)).not.toContain('Private');
});
test('auto-report sends a route-pattern URL and a redacted message and stack', async () => {
  const bodies = captureFetchBodies();
  const error = Object.assign(new Error(SENSITIVE_MESSAGE), {
    stack: SENSITIVE_STACK,
  });
  await reportErrorTelemetry(error, SENSITIVE_URL);
  expect(bodies).toHaveLength(1);
  expectNoSensitiveValuesOnTheWire(bodies[0] ?? '');
  const sent = JSON.parse(bodies[0] ?? '{}');
  expect(sent.url).toBe('https://app.invalid/summary');
  expect(sent.message).toBe(
    `[message omitted: ${SENSITIVE_MESSAGE.length} characters]`,
  );
  expect(sent.stackTrace).toContain(
    'TypeError\n    at <anonymous> (https://app.invalid/assets/main-abcdef12.js:12:34)',
  );
});
test('errors that differ only by query string or redacted data are sent once', async () => {
  const bodies = captureFetchBodies();
  const failure = (email: string) =>
    Object.assign(new Error(`Save failed for ${email}`), { stack: 'Error' });
  await reportErrorTelemetry(
    failure('jane@example.com'),
    'https://scc.example/summary?token=one',
  );
  await reportErrorTelemetry(
    failure('sam@example.org'),
    'https://alice:pw@scc.example/summary?token=two#x',
  );
  expect(bodies).toHaveLength(1);
  expect(JSON.parse(bodies[0] ?? '{}')).toMatchObject({
    url: 'https://app.invalid/summary',
    message: '[message omitted: 32 characters]',
  });
});
test('an error with no stack still reports its class name, so different classes stay apart', async () => {
  const bodies = captureFetchBodies();
  const withoutStack = (error: Error) =>
    Object.defineProperty(error, 'stack', { value: undefined });
  await reportErrorTelemetry(
    withoutStack(new TypeError('a')),
    'https://scc.example/summary',
  );
  await reportErrorTelemetry(
    withoutStack(new RangeError('b')),
    'https://scc.example/summary',
  );
  expect(bodies.map((body) => JSON.parse(body).stackTrace)).toEqual([
    'TypeError',
    'RangeError',
  ]);
});
test('reporting failure resolves to a failed Result', async () => {
  globalThis.fetch = (async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;
  expect(await reportErrorTelemetry('Broken')).toEqual({
    ok: false,
    error: 'network',
  });
});
test('auto-report cuts oversized telemetry instead of sending a body the Worker refuses', async () => {
  const bodies = captureFetchBodies();
  const error = new Error('word '.repeat(2_000));
  error.stack = `Error: Broken\n${'    at frame (https://scc.example/a.js:1:2)\n'.repeat(1_000)}`;
  await reportErrorTelemetry(
    error,
    `https://scc.example/${'a/'.repeat(2_500)}`,
  );
  const sent = JSON.parse(bodies[0] ?? '{}');
  expect(sent.message.length).toBeLessThanOrEqual(REPORT_FIELD_LIMITS.message);
  expect(sent.stackTrace.length).toBeLessThanOrEqual(
    REPORT_FIELD_LIMITS.stackTrace,
  );
  expect(sent.url.length).toBeLessThanOrEqual(REPORT_FIELD_LIMITS.url);
  expect(errorTelemetrySchema.safeParse(sent).success).toBe(true);
});
