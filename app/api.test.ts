import { afterEach, expect, test } from 'bun:test';
import { sanitizeErrorTelemetry } from '../shared/errorReporting.ts';
import { TRUNCATED } from '../shared/telemetryRedaction.ts';
import {
  expectNoSensitiveValues,
  SENSITIVE_DESCRIPTION,
  SENSITIVE_MESSAGE,
  SENSITIVE_STACK,
  SENSITIVE_URL,
} from '../test/sensitive-reports.ts';
import {
  createExperience,
  createSkills,
  createSummaries,
  reportError,
  reportIssue,
} from './api.ts';

const original = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = original;
});
function mockFetch(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
) {
  globalThis.fetch = handler as typeof fetch;
}
test('a User report is sanitized before it leaves the browser; Error telemetry arrives sanitized', async () => {
  const bodies: string[] = [];
  mockFetch(async (_path, init) => {
    bodies.push(String(init?.body));
    return Response.json({ ok: true });
  });
  const timestamp = new Date().toISOString();
  const telemetry = sanitizeErrorTelemetry({
    timestamp,
    url: SENSITIVE_URL,
    message: SENSITIVE_MESSAGE,
    stackTrace: SENSITIVE_STACK,
  });
  await reportError(telemetry);
  expect(bodies[0]).toBe(JSON.stringify(telemetry));
  await reportIssue({
    timestamp,
    url: SENSITIVE_URL,
    description: `${SENSITIVE_DESCRIPTION} ${'d'.repeat(9_000)}`,
  });
  expect(bodies).toHaveLength(2);
  for (const body of bodies) {
    expectNoSensitiveValues(body);
    expect(JSON.parse(body).url).toBe('https://scc.example/summary');
  }
  expect(JSON.parse(bodies[1] ?? '{}').description).toEndWith(TRUNCATED);
});
test('API client sends JSON with signal and parses shared output schemas for all five routes', async () => {
  const signal = new AbortController().signal;
  const requests: string[] = [];
  mockFetch(async (path, init) => {
    requests.push(String(path));
    expect(init?.method).toBe('POST');
    expect(init?.signal).toBe(signal);
    if (path === '/api/summaries')
      return Response.json([{ title: 'Developer', text: 'Suggestion' }]);
    if (path === '/api/skills' || path === '/api/experience')
      return Response.json({ expertRecommended: ['A'], other: [] });
    return Response.json({ ok: true });
  });
  expect(await createSummaries({ prompt: 'job' }, signal)).toEqual({
    ok: true,
    value: [{ title: 'Developer', text: 'Suggestion' }],
  });
  expect((await createSkills({ prompt: 'job' }, signal)).ok).toBe(true);
  expect((await createExperience({ prompt: 'job' }, signal)).ok).toBe(true);
  expect(
    (
      await reportError(
        sanitizeErrorTelemetry({
          timestamp: new Date().toISOString(),
          message: 'error',
          url: '/info',
        }),
        signal,
      )
    ).ok,
  ).toBe(true);
  expect(
    (
      await reportIssue(
        {
          timestamp: new Date().toISOString(),
          description: 'issue',
          url: 'https://scc.example',
        },
        signal,
      )
    ).ok,
  ).toBe(true);
  expect(requests).toHaveLength(5);
});
for (const [status, error] of [
  [400, 'validation'],
  [403, 'forbidden'],
  [404, 'not-found'],
  [405, 'method'],
  [415, 'media-type'],
  [500, 'server'],
  [502, 'server'],
] as const) {
  test(`API status ${status} maps to ${error}`, async () => {
    mockFetch(async () =>
      Response.json({ error: 'private provider message' }, { status }),
    );
    expect(await createSummaries({ prompt: 'job' })).toEqual({
      ok: false,
      error,
      status,
    });
  });
}
test('schema mismatch, malformed JSON, network failure, and abort resolve without throwing', async () => {
  mockFetch(async () => Response.json({ unexpected: true }));
  expect(await createSummaries({ prompt: 'job' })).toEqual({
    ok: false,
    error: 'validation',
  });
  mockFetch(async () => new Response('{'));
  expect((await createSummaries({ prompt: 'job' })).ok).toBe(false);
  mockFetch(async () => {
    throw new Error('offline');
  });
  expect(await createSummaries({ prompt: 'job' })).toEqual({
    ok: false,
    error: 'network',
  });
  const controller = new AbortController();
  controller.abort();
  expect(await createSummaries({ prompt: 'job' }, controller.signal)).toEqual({
    ok: false,
    error: 'aborted',
  });
});

test('aborting an in-flight request resolves to a failed Result', async () => {
  mockFetch(
    (_path, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        );
      }),
  );
  const controller = new AbortController();
  const result = createSummaries({ prompt: 'job' }, controller.signal);
  controller.abort();
  expect(await result).toEqual({ ok: false, error: 'aborted' });
});

for (const [name, send] of [
  [
    'reportError',
    (signal?: AbortSignal) =>
      reportError(
        sanitizeErrorTelemetry({
          url: 'https://scc.example/info',
          message: 'Failed',
          timestamp: new Date().toISOString(),
        }),
        signal,
      ),
  ],
  [
    'reportIssue',
    (signal?: AbortSignal) =>
      reportIssue(
        {
          url: 'https://scc.example/info',
          description: 'Failed',
          timestamp: new Date().toISOString(),
        },
        signal,
      ),
  ],
] as const) {
  test(`${name} returns Results for success, non-2xx, malformed acknowledgement, network and abort`, async () => {
    mockFetch(async () => Response.json({ ok: true }));
    expect(await send()).toEqual({ ok: true, value: { ok: true } });
    mockFetch(async () =>
      Response.json({ error: 'GitHub failed' }, { status: 502 }),
    );
    expect(await send()).toEqual({ ok: false, error: 'server', status: 502 });
    mockFetch(async () => Response.json({ ok: false }));
    expect(await send()).toEqual({ ok: false, error: 'validation' });
    mockFetch(async () => {
      throw new Error('offline');
    });
    expect(await send()).toEqual({ ok: false, error: 'network' });
    mockFetch(
      (_path, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          );
        }),
    );
    const controller = new AbortController();
    const result = send(controller.signal);
    controller.abort();
    expect(await result).toEqual({ ok: false, error: 'aborted' });
  });
}
