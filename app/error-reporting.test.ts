import { afterEach, expect, test } from 'bun:test';
import { resetReportedTelemetryForTests } from '../shared/errorReporting.ts';
import {
  expectNoSensitiveValues,
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
  const bodies: unknown[] = [];
  globalThis.fetch = (async (_path: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json({ ok: true });
  }) as unknown as typeof fetch;
  const error = Object.assign(new Error('Page failed'), {
    user: { name: 'Private' },
  });
  await reportErrorTelemetry(error, 'https://scc.example/info');
  await reportErrorTelemetry(error, 'https://scc.example/info');
  await reportErrorTelemetry(new Response(null, { status: 404 }));
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toEqual({
    url: 'https://scc.example/info',
    message: error.message,
    stackTrace: error.stack,
    timestamp: expect.any(String),
  });
  expect(JSON.stringify(bodies)).not.toContain('Private');
});
test('auto-report sends a path-only URL and a redacted message and stack', async () => {
  const bodies: string[] = [];
  globalThis.fetch = (async (_path: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(String(init?.body));
    return Response.json({ ok: true });
  }) as unknown as typeof fetch;
  const error = Object.assign(new Error(SENSITIVE_MESSAGE), {
    stack: SENSITIVE_STACK,
  });
  await reportErrorTelemetry(error, SENSITIVE_URL);
  expect(bodies).toHaveLength(1);
  expectNoSensitiveValues(bodies[0] ?? '');
  const sent = JSON.parse(bodies[0] ?? '{}');
  expect(sent.url).toBe('https://scc.example/summary');
  expect(sent.message).toBe('Save failed for [redacted], call [redacted]');
  expect(sent.stackTrace).toContain(
    'at saveSummary (https://scc.example/assets/main-abcdef12.js:12:34)',
  );
});
test('errors that differ only by query string or redacted data are sent once', async () => {
  const bodies: string[] = [];
  globalThis.fetch = (async (_path: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(String(init?.body));
    return Response.json({ ok: true });
  }) as unknown as typeof fetch;
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
    url: 'https://scc.example/summary',
    message: 'Save failed for [redacted]',
  });
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
