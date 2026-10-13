import { afterEach, expect, test } from 'bun:test';
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
        { timestamp: new Date().toISOString(), message: 'error', url: '/info' },
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
