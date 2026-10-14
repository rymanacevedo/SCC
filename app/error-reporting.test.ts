import { afterEach, expect, test } from 'bun:test';
import { resetReportedTelemetryForTests } from '../shared/errorReporting.ts';
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
test('reporting failure resolves to a failed Result', async () => {
  globalThis.fetch = (async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;
  expect(await reportErrorTelemetry('Broken')).toEqual({
    ok: false,
    error: 'network',
  });
});
