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
import { EnvironmentValidationError } from '../lib/environment.ts';
import { errorTelemetrySchema } from '../services/github.ts';
import { createRouteErrorMiddleware, type RouteErrorPolicy } from './errors.ts';
import { bodyValidation } from './guards.ts';

afterEach(() => mock.restore());

async function runErrorMiddleware(
  error: unknown,
  {
    payload,
    unknownErrorStatus = 502,
    logReportMetadata = true,
    errorMessage = 'Failed',
  }: Partial<RouteErrorPolicy> & { payload?: unknown } = {},
) {
  const log = spyOn(console, 'error').mockImplementation(() => {});
  log.mockClear();
  const { key } = bodyValidation(errorTelemetrySchema, 1_024);
  const middleware = createRouteErrorMiddleware('/api/errors', key, {
    unknownErrorStatus,
    logReportMetadata,
    errorMessage,
  });
  const context = {
    request: new Request('https://scc.example/api/errors'),
    get: () => payload,
  } as unknown as RequestContext;
  const response = (await middleware(context, async () => {
    throw error;
  })) as Response;
  return {
    response,
    entry: log.mock.calls[0]?.[0] as Record<string, unknown>,
  };
}

async function logFor(error: unknown, payload?: unknown) {
  const { response, entry } = await runErrorMiddleware(error, { payload });
  expect(response.status).toBe(502);
  return entry;
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

test('an unrecognized error returns the declared unknownErrorStatus and logs category unknown', async () => {
  const serverError = await runErrorMiddleware(new Error('Broken'), {
    unknownErrorStatus: 500,
    errorMessage: 'Generation failed',
  });
  expect(serverError.response.status).toBe(500);
  expect(await serverError.response.json()).toEqual({
    error: 'Generation failed',
  });
  expect(serverError.entry).toMatchObject({
    route: '/api/errors',
    category: 'unknown',
  });

  const gatewayError = await runErrorMiddleware(new Error('Broken'), {
    unknownErrorStatus: 502,
    errorMessage: 'Reporting failed',
  });
  expect(gatewayError.response.status).toBe(502);
  expect(await gatewayError.response.json()).toEqual({
    error: 'Reporting failed',
  });
  expect(gatewayError.entry).toMatchObject({
    route: '/api/errors',
    category: 'unknown',
  });
});

test('classified errors keep their own status regardless of unknownErrorStatus', async () => {
  const providerFailure = await runErrorMiddleware(
    new APICallError({
      message: 'upstream failed',
      url: 'https://provider.example',
      requestBodyValues: {},
      statusCode: 503,
      isRetryable: false,
    }),
    { unknownErrorStatus: 500 },
  );
  expect(providerFailure.response.status).toBe(502);
  expect(providerFailure.entry.category).toBe('provider');

  const configFailure = await runErrorMiddleware(
    new EnvironmentValidationError('github', new Error('missing')),
    { unknownErrorStatus: 502 },
  );
  expect(configFailure.response.status).toBe(500);
  expect(configFailure.entry.category).toBe('config');
});

test('report metadata is logged when logReportMetadata is true', async () => {
  const { entry } = await runErrorMiddleware(new Error('Broken'), {
    logReportMetadata: true,
    payload: {
      timestamp: '2026-10-13T00:00:00.000Z',
      url: SENSITIVE_URL,
    },
  });
  expect(entry).toMatchObject({
    timestamp: '2026-10-13T00:00:00.000Z',
    url: 'https://app.invalid/summary',
  });
});

test('report metadata is omitted when logReportMetadata is false', async () => {
  const { entry } = await runErrorMiddleware(new Error('Broken'), {
    logReportMetadata: false,
    payload: {
      timestamp: '2026-10-13T00:00:00.000Z',
      url: SENSITIVE_URL,
    },
  });
  expect(entry).not.toHaveProperty('timestamp');
  expect(entry).not.toHaveProperty('url');
});
