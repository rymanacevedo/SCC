import { afterEach, describe, expect, mock, test } from 'bun:test';
import app from './index';

const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;

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
  console.error = originalConsoleError;
});

function getLoggedObject(
  consoleErrorMock: ReturnType<typeof mock>,
): Record<string, unknown> {
  return (consoleErrorMock.mock.calls[0] as [Record<string, unknown>])[0];
}

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
    const consoleErrorMock = mock(() => {});
    console.error = consoleErrorMock as typeof console.error;
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
    expect(consoleErrorMock).toHaveBeenCalledTimes(1);
    expect(getLoggedObject(consoleErrorMock)).toMatchObject({
      route: '/api/errors',
      category: 'github_network',
      timestamp: payload.timestamp,
      url: payload.url,
    });
  });

  test('returns 500 when GitHub environment variables are missing', async () => {
    const consoleErrorMock = mock(() => {});
    console.error = consoleErrorMock as typeof console.error;

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
      {
        ALLOWED_ORIGIN: env.ALLOWED_ORIGIN,
        OPENAI_API_KEY: env.OPENAI_API_KEY,
      },
    );

    expect(response.status).toBe(500);
    expect(consoleErrorMock).toHaveBeenCalledTimes(1);
    expect(getLoggedObject(consoleErrorMock)).toMatchObject({
      route: '/api/errors',
      category: 'config',
      timestamp: payload.timestamp,
      url: payload.url,
    });
  });

  test('returns 502 when GitHub rejects the error report request', async () => {
    const consoleErrorMock = mock(() => {});
    console.error = consoleErrorMock as typeof console.error;
    globalThis.fetch = mock(async () => {
      return new Response('Bad credentials', { status: 401 });
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
    expect(consoleErrorMock).toHaveBeenCalledTimes(1);
    expect(getLoggedObject(consoleErrorMock)).toMatchObject({
      route: '/api/errors',
      category: 'github_http',
      githubStatus: 401,
      githubResponseSnippet: 'Bad credentials',
    });
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
    const consoleErrorMock = mock(() => {});
    console.error = consoleErrorMock as typeof console.error;
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
    expect(consoleErrorMock).toHaveBeenCalledTimes(1);
    expect(getLoggedObject(consoleErrorMock)).toMatchObject({
      route: '/api/report-issue',
      category: 'github_network',
      timestamp: '2026-04-27T12:00:00.000Z',
      url: 'https://example.com/summary',
    });
  });

  test('returns 500 when GitHub environment variables are missing for user issue reports', async () => {
    const consoleErrorMock = mock(() => {});
    console.error = consoleErrorMock as typeof console.error;

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
      {
        ALLOWED_ORIGIN: env.ALLOWED_ORIGIN,
        OPENAI_API_KEY: env.OPENAI_API_KEY,
      },
    );

    expect(response.status).toBe(500);
    expect(consoleErrorMock).toHaveBeenCalledTimes(1);
    expect(getLoggedObject(consoleErrorMock)).toMatchObject({
      route: '/api/report-issue',
      category: 'config',
      timestamp: '2026-04-27T12:00:00.000Z',
      url: 'https://example.com/summary',
    });
  });

  test('does not require OPENAI_API_KEY for user issue reports', async () => {
    const fetchMock = mock(async () => {
      return new Response(JSON.stringify({ id: 2 }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    });
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
      {
        ALLOWED_ORIGIN: env.ALLOWED_ORIGIN,
        GITHUB_REPO: env.GITHUB_REPO,
        GITHUB_TOKEN: env.GITHUB_TOKEN,
      },
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('returns 502 when GitHub rejects the user issue report request', async () => {
    const consoleErrorMock = mock(() => {});
    console.error = consoleErrorMock as typeof console.error;
    globalThis.fetch = mock(async () => {
      return new Response('Validation failed', { status: 422 });
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
    expect(consoleErrorMock).toHaveBeenCalledTimes(1);
    expect(getLoggedObject(consoleErrorMock)).toMatchObject({
      route: '/api/report-issue',
      category: 'github_http',
      githubStatus: 422,
      githubResponseSnippet: 'Validation failed',
    });
  });
});
