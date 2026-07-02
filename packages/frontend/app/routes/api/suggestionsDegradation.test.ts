import { afterEach, describe, expect, test } from 'bun:test';

// Regression test for issue #160: when the backend suggestions endpoints fail
// (500s on large multi-job prompts, outages, rate limits), the client-side
// proxy actions must return a degraded payload instead of throwing. A throw
// from these fetcher actions unmounts the calling page into its ErrorBoundary,
// which removes the "Next Step" button and blocks the user from progressing.

process.env.VITE_HONO_BACKEND_URL = 'http://backend.test';

const { clientAction: skillsAction } = await import('./skills');
const { clientAction: summaryAction } = await import('./summary');
const { clientAction: experienceEntryAction } = await import(
  './experienceEntry'
);

const originalFetch = globalThis.fetch;

function failingBackend(status: number) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: 'Failed to generate content' }), {
      status,
    })) as typeof fetch;
}

function rejectingBackend() {
  globalThis.fetch = (async () => {
    throw new TypeError('fetch failed');
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function makeRequest(fields: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }
  return new Request('http://localhost/api/test', {
    method: 'POST',
    body: form,
  });
}

const actionArgs = (fields: Record<string, string>) =>
  ({ request: makeRequest(fields), params: {}, context: {} }) as never;

const cases = [
  {
    name: 'skills',
    action: skillsAction,
    fields: { jobSearch: '<job><jobTitle>Engineer</jobTitle></job>' },
  },
  {
    name: 'summary',
    action: summaryAction,
    fields: { jobSearch: '<job><jobTitle>Engineer</jobTitle></job>' },
  },
  {
    name: 'experienceEntry',
    action: experienceEntryAction,
    fields: { jobTitleSearch: 'Engineer' },
  },
] as const;

describe.each(cases)('/api/$name proxy degradation', ({ action, fields }) => {
  test('returns an error payload instead of throwing when the backend 500s', async () => {
    failingBackend(500);
    const result = await action(actionArgs(fields));
    expect(result).toBeInstanceOf(Response);
    const body = await (result as Response).json();
    expect(body).toHaveProperty('error');
  });

  test('returns an error payload instead of rejecting when the backend is unreachable', async () => {
    rejectingBackend();
    const result = await action(actionArgs(fields));
    expect(result).toBeInstanceOf(Response);
    const body = await (result as Response).json();
    expect(body).toHaveProperty('error');
  });
});
