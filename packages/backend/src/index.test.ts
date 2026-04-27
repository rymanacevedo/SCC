import { afterEach, describe, expect, mock, test } from 'bun:test';
import app from './index';

const originalFetch = globalThis.fetch;

const env = {
  ALLOWED_ORIGIN: 'https://example.com',
  GITHUB_REPO: 'acme/scc',
  GITHUB_TOKEN: 'token-123',
  OPENAI_API_KEY: 'openai-123',
};

const payload = {
  timestamp: '2026-04-27T12:00:00.000Z',
  url: 'https://example.com/skills',
  message: 'Widget exploded',
  stackTrace: 'Error: Widget exploded\n    at render',
};

afterEach(() => {
  mock.restore();
  globalThis.fetch = originalFetch;
});

describe('POST /api/errors', () => {
  test('creates a GitHub issue with structured labels and body', async () => {
    const fetchMock = mock(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        return new Response(JSON.stringify({ id: 1 }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await app.request(
      '/api/errors',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://example.com',
        },
        body: JSON.stringify(payload),
      },
      env,
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));

    expect(body.labels).toEqual(['bug', 'auto-reported']);
    expect(body.title).toContain('Widget exploded');
    expect(body.body).toContain('Timestamp: 2026-04-27T12:00:00.000Z');
    expect(body.body).toContain('URL: https://example.com/skills');
    expect(body.body).toContain('Stack trace');
  });

  test('returns 400 for invalid payloads', async () => {
    const response = await app.request(
      '/api/errors',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://example.com',
        },
        body: JSON.stringify({ message: '' }),
      },
      env,
    );

    expect(response.status).toBe(400);
  });

  test('returns 502 when GitHub is unreachable', async () => {
    globalThis.fetch = mock(async () => {
      throw new Error('github down');
    }) as unknown as typeof fetch;

    const response = await app.request(
      '/api/errors',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://example.com',
        },
        body: JSON.stringify(payload),
      },
      env,
    );

    expect(response.status).toBe(502);
  });
});

describe('POST /api/report-issue', () => {
  test('creates a GitHub issue for user-submitted reports', async () => {
    const fetchMock = mock(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        return new Response(JSON.stringify({ id: 2 }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await app.request(
      '/api/report-issue',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://example.com',
        },
        body: JSON.stringify({
          description: 'The save button did nothing.',
          timestamp: '2026-04-27T12:00:00.000Z',
          url: 'https://example.com/summary',
        }),
      },
      env,
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));

    expect(body.title).toBe('User-reported issue');
    expect(body.labels).toEqual(['bug', 'user-reported']);
    expect(body.body).toContain('The save button did nothing.');
    expect(body.body).toContain('URL: https://example.com/summary');
  });

  test('returns 400 for invalid user issue payloads', async () => {
    const response = await app.request(
      '/api/report-issue',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://example.com',
        },
        body: JSON.stringify({ description: '' }),
      },
      env,
    );

    expect(response.status).toBe(400);
  });

  test('returns 502 when user issue creation fails', async () => {
    globalThis.fetch = mock(async () => {
      throw new Error('github down');
    }) as unknown as typeof fetch;

    const response = await app.request(
      '/api/report-issue',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://example.com',
        },
        body: JSON.stringify({
          description: 'The save button did nothing.',
          timestamp: '2026-04-27T12:00:00.000Z',
          url: 'https://example.com/summary',
        }),
      },
      env,
    );

    expect(response.status).toBe(502);
  });
});
