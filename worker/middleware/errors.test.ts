import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import { APICallError } from 'ai';
import type { RequestContext } from 'remix/router';
import { TRUNCATED } from '../../shared/telemetryRedaction.ts';
import {
  expectNoSensitiveValues,
  SENSITIVE_DYNAMIC_URL,
  SENSITIVE_INJECTION_URL,
  SENSITIVE_MESSAGE,
  SENSITIVE_STACK,
  SENSITIVE_UNKNOWN_URL,
  SENSITIVE_URL,
} from '../../test/sensitive-reports.ts';
import { errorTelemetrySchema } from '../services/github.ts';
import { createRouteErrorMiddleware } from './errors.ts';
import { bodyValidation } from './guards.ts';

afterEach(() => mock.restore());

async function logFor(error: unknown, payload?: unknown) {
  const log = spyOn(console, 'error').mockImplementation(() => {});
  const { key } = bodyValidation(errorTelemetrySchema, 1_024);
  const middleware = createRouteErrorMiddleware('/api/errors', key, {
    errorMessage: 'Failed',
  });
  const context = {
    request: new Request('https://scc.example/api/errors'),
    get: () => payload,
  } as unknown as RequestContext;
  const response = await middleware(context, async () => {
    throw error;
  });
  expect((response as Response).status).toBe(502);
  return log.mock.calls[0]?.[0] as Record<string, unknown>;
}

test('logged report metadata and error text are route patterns and placeholders; no provider URL is logged', async () => {
  const error = new APICallError({
    message: SENSITIVE_MESSAGE,
    url: SENSITIVE_URL,
    requestBodyValues: {},
    statusCode: 401,
    isRetryable: false,
  });
  error.stack = SENSITIVE_STACK;
  const entry = await logFor(error, {
    timestamp: '2026-10-13T00:00:00.000Z',
    url: SENSITIVE_URL,
  });
  expectNoSensitiveValues(JSON.stringify(entry));
  expect(entry).toMatchObject({
    category: 'provider',
    url: 'https://app.invalid/summary',
    message: `[message omitted: ${SENSITIVE_MESSAGE.length} characters]`,
  });
  expect(String(entry.stack)).toContain(
    '    at <anonymous> (https://app.invalid/[redacted]:12:34)',
  );
  expect(String(entry.stack)).toContain(
    '    [frame omitted]\n    at <anonymous> (',
  );
  expect(String(entry.stack)).toContain(
    '    at <anonymous> (https://app.invalid/[redacted]:3:4)',
  );
  expect(entry).not.toHaveProperty('providerUrl');
});

test('a report path the browser chose reaches no log line', async () => {
  for (const url of [
    SENSITIVE_INJECTION_URL,
    SENSITIVE_UNKNOWN_URL,
    SENSITIVE_DYNAMIC_URL,
  ]) {
    const error = new Error('Broken');
    error.stack = `Error: Broken\n    at render (${url}.js:1:2)`;
    const entry = await logFor(error, {
      timestamp: '2026-10-13T00:00:00.000Z',
      url,
    });
    expectNoSensitiveValues(JSON.stringify(entry));
    expect(entry.url).toBe('https://app.invalid/[unknown-route]');
    expect(entry.stack).toBe(
      'Error\n    at <anonymous> (https://app.invalid/[redacted]:1:2)',
    );
  }
});

test('an oversized report timestamp is logged as a bounded canonical value', async () => {
  const entry = await logFor(new Error('Broken'), {
    timestamp: `2026-10-13T00:00:00.${'1'.repeat(70_000)}Z`,
    url: SENSITIVE_URL,
  });
  expect(entry.timestamp).toBe('2026-10-13T00:00:00.111Z');
});

test('an over-long logged stack is truncated with a marker', async () => {
  const error = new Error('Broken');
  error.stack = `Error: Broken\n${'    at frame (https://scc.example/a.js:1:2)\n'.repeat(500)}`;
  const entry = await logFor(error);
  expect(String(entry.stack).endsWith(TRUNCATED)).toBe(true);
  expect(String(entry.stack).length).toBeLessThan(4_100);
});
