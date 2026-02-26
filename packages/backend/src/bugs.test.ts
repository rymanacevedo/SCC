import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import app from './index';

const testEnv = {
  ALLOWED_ORIGIN: 'http://localhost:3000',
  OPENAI_API_KEY: 'test-openai-key',
  GITHUB_TOKEN: 'test-github-token',
  GITHUB_REPO: 'owner/repo',
};

const validPayload = {
  description: 'The form loses data when navigating back',
  url: 'http://localhost:3000/experience',
};

function postBugs(body: unknown, env = testEnv) {
  return app.request(
    '/api/bugs',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    env,
  );
}

describe('POST /api/bugs', () => {
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
    const res = await postBugs(validPayload);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [fetchUrl, fetchOptions] = mockFetch.mock.calls[0];
    expect(fetchUrl).toBe('https://api.github.com/repos/owner/repo/issues');
    expect(fetchOptions.method).toBe('POST');
    expect(fetchOptions.headers.Authorization).toBe('Bearer test-github-token');

    const githubBody = JSON.parse(fetchOptions.body);
    expect(githubBody.title).toBe(validPayload.description);
    expect(githubBody.labels).toEqual(['bug']);
    expect(githubBody.body).toContain(validPayload.url);
    expect(githubBody.body).toContain(validPayload.description);
    expect(githubBody.body).toContain('Bug Report');
    expect(githubBody.body).toContain('Auto-reported from the application');
  });

  test('truncates long descriptions in the title', async () => {
    const longDescription = 'A'.repeat(100);
    const res = await postBugs({
      ...validPayload,
      description: longDescription,
    });
    expect(res.status).toBe(200);

    const [, fetchOptions] = mockFetch.mock.calls[0];
    const githubBody = JSON.parse(fetchOptions.body);
    expect(githubBody.title).toBe(`${'A'.repeat(67)}...`);
    // Full description still in body
    expect(githubBody.body).toContain(longDescription);
  });

  test('rejects payload with missing fields', async () => {
    const res = await postBugs({});
    expect(res.status).toBe(400);
  });

  test('rejects empty description', async () => {
    const res = await postBugs({ ...validPayload, description: '' });
    expect(res.status).toBe(400);
  });

  test('rejects missing url', async () => {
    const res = await postBugs({ description: 'Something broke' });
    expect(res.status).toBe(400);
  });

  test('rejects invalid url', async () => {
    const res = await postBugs({
      description: 'Something broke',
      url: 'not-a-url',
    });
    expect(res.status).toBe(400);
  });

  test('returns 500 when GITHUB_TOKEN is missing', async () => {
    const { GITHUB_TOKEN: _, ...envWithoutToken } = testEnv;
    const res = await postBugs(validPayload, envWithoutToken);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'GitHub configuration missing' });
  });

  test('returns 500 when GITHUB_REPO is missing', async () => {
    const { GITHUB_REPO: _, ...envWithoutRepo } = testEnv;
    const res = await postBugs(validPayload, envWithoutRepo);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'GitHub configuration missing' });
  });

  test('returns 500 when GitHub API returns a non-ok response', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('Not Found', { status: 404 })),
    ) as typeof fetch;

    const res = await postBugs(validPayload);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: 'Failed to create GitHub issue',
    });
  });

  test('returns 500 when fetch throws a network error', async () => {
    globalThis.fetch = mock(() =>
      Promise.reject(new Error('Network error')),
    ) as typeof fetch;

    const res = await postBugs(validPayload);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to submit bug report' });
  });
});
