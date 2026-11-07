import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import { APICallError } from 'ai';
import type { RequestContext } from 'remix/router';
import { TRUNCATED } from '../../shared/telemetryRedaction.ts';
import {
  expectNoSensitiveValues,
  SENSITIVE_MESSAGE,
  SENSITIVE_STACK,
  SENSITIVE_URL,
} from '../../test/sensitive-reports.ts';
import { errorTelemetrySchema } from '../services/github.ts';
import { createRouteErrorMiddleware } from './errors.ts';
import { bodyValidation } from './guards.ts';

afterEach(() => mock.restore());

async function logFor(error: unknown, payload?: unknown) {
  const log = spyOn(console, 'error').mockImplementation(() => {});
  const { key } = bodyValidation(errorTelemetrySchema);
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

test('logged report metadata, error text and provider URLs are path-only and redacted', async () => {
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
    url: 'https://scc.example/summary',
    providerUrl: 'https://scc.example/summary',
    message: 'Save failed for [redacted], call [redacted]',
  });
  expect(String(entry.stack)).toContain(
    'at saveSummary (https://scc.example/assets/main-abcdef12.js:12:34)',
  );
  expect(String(entry.stack)).toContain('    [frame omitted]\n    at retry (');
  expect(String(entry.stack)).toContain(
    'at loadPage (https://scc.example/assets/page.js:3:4)',
  );
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
