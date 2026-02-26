import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import app from './index';

const testEnv = {
  ALLOWED_ORIGIN: 'http://localhost:3000',
  OPENAI_API_KEY: 'test-openai-key',
  GITHUB_TOKEN: 'test-github-token',
  GITHUB_REPO: 'owner/repo',
};

const validPayload = {
  timestamp: '2026-02-26T04:00:00.000Z',
  url: 'http://localhost:3000/experience',
  message: 'Something went wrong',
  stackTrace: 'Error: Something went wrong\n    at Object.<anonymous>',
};

function postErrors(body: unknown, env = testEnv) {
  return app.request(
    '/api/errors',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    env,
  );
}

describe('POST /api/errors', () => {
  const originalFetch = globalThis.fetch;
  let mockFetch: ReturnType<typeof mock>;

  beforeEach(() => {
    mockFetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ id: 1 }), { status: 201 })),
    );
    globalThis.fetch = mockFetch as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('creates a GitHub issue with correct title, labels, and body', async () => {
    const res = await postErrors(validPayload);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [fetchUrl, fetchOptions] = mockFetch.mock.calls[0];
    expect(fetchUrl).toBe('https://api.github.com/repos/owner/repo/issues');
    expect(fetchOptions.method).toBe('POST');
    expect(fetchOptions.headers.Authorization).toBe('Bearer test-github-token');

    const githubBody = JSON.parse(fetchOptions.body);
    expect(githubBody.title).toBe('[Error] Something went wrong');
    expect(githubBody.labels).toEqual(['bug', 'auto-reported']);
    expect(githubBody.body).toContain(validPayload.timestamp);
    expect(githubBody.body).toContain(validPayload.url);
    expect(githubBody.body).toContain(validPayload.message);
    expect(githubBody.body).toContain(validPayload.stackTrace);
  });

  test('truncates long error messages in the title', async () => {
    const longMessage = 'A'.repeat(100);
    const res = await postErrors({ ...validPayload, message: longMessage });
    expect(res.status).toBe(200);

    const [, fetchOptions] = mockFetch.mock.calls[0];
    const githubBody = JSON.parse(fetchOptions.body);
    expect(githubBody.title).toBe(`[Error] ${'A'.repeat(67)}...`);
  });

  test('allows empty stackTrace', async () => {
    const res = await postErrors({ ...validPayload, stackTrace: '' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  test('rejects payload with missing fields', async () => {
    const res = await postErrors({});
    expect(res.status).toBe(400);
  });

  test('rejects empty timestamp', async () => {
    const res = await postErrors({ ...validPayload, timestamp: '' });
    expect(res.status).toBe(400);
  });

  test('rejects empty url', async () => {
    const res = await postErrors({ ...validPayload, url: '' });
    expect(res.status).toBe(400);
  });

  test('rejects empty message', async () => {
    const res = await postErrors({ ...validPayload, message: '' });
    expect(res.status).toBe(400);
  });

  test('returns 500 when GITHUB_TOKEN is missing', async () => {
    const { GITHUB_TOKEN: _, ...envWithoutToken } = testEnv;
    const res = await postErrors(validPayload, envWithoutToken);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'GitHub configuration missing' });
  });

  test('returns 500 when GITHUB_REPO is missing', async () => {
    const { GITHUB_REPO: _, ...envWithoutRepo } = testEnv;
    const res = await postErrors(validPayload, envWithoutRepo);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'GitHub configuration missing' });
  });

  test('returns 500 when GitHub API returns a non-ok response', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('Not Found', { status: 404 })),
    ) as typeof fetch;

    const res = await postErrors(validPayload);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: 'Failed to create GitHub issue',
    });
  });

  test('returns 500 when fetch throws a network error', async () => {
    globalThis.fetch = mock(() =>
      Promise.reject(new Error('Network error')),
    ) as typeof fetch;

    const res = await postErrors(validPayload);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to report error' });
  });
});
