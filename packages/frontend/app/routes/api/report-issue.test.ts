import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

const originalFetch = globalThis.fetch;
let clientAction: typeof import('./report-issue').clientAction;

function getStatus(result: Awaited<ReturnType<typeof clientAction>>) {
  return result instanceof Response ? result.status : result.init?.status;
}

afterEach(() => {
  mock.restore();
  globalThis.fetch = originalFetch;
});

beforeEach(async () => {
  mock.module('../../lib/environment', () => ({
    VITE_HONO_BACKEND_URL: 'https://backend.example.com',
  }));

  ({ clientAction } = await import('./report-issue'));
});

describe('POST /api/report-issue', () => {
  test('forwards validated reports to the backend', async () => {
    const fetchMock = mock(async () => {
      return Response.json({ ok: true });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const formData = new FormData();
    formData.set('description', 'The save button did nothing.');
    formData.set('timestamp', '2026-04-27T12:00:00.000Z');
    formData.set('url', 'https://example.com/summary');

    const response = await clientAction({
      request: new Request('http://localhost/api/report-issue', {
        method: 'POST',
        body: formData,
      }),
      context: {},
      params: {},
    });

    expect(getStatus(response)).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [input, init] = fetchMock.mock.calls[0];
    expect(String(input)).toContain('/api/report-issue');
    expect(JSON.parse(String(init?.body))).toEqual({
      description: 'The save button did nothing.',
      timestamp: '2026-04-27T12:00:00.000Z',
      url: 'https://example.com/summary',
    });
  });

  test('returns 400 for invalid form submissions', async () => {
    const formData = new FormData();
    formData.set('description', '');
    formData.set('timestamp', 'nope');
    formData.set('url', 'not-a-url');

    const response = await clientAction({
      request: new Request('http://localhost/api/report-issue', {
        method: 'POST',
        body: formData,
      }),
      context: {},
      params: {},
    });

    expect(getStatus(response)).toBe(400);
  });

  test('returns 502 when the backend is unreachable', async () => {
    globalThis.fetch = mock(async () => {
      throw new Error('network down');
    }) as typeof fetch;

    const formData = new FormData();
    formData.set('description', 'The save button did nothing.');
    formData.set('timestamp', '2026-04-27T12:00:00.000Z');
    formData.set('url', 'https://example.com/summary');

    const response = await clientAction({
      request: new Request('http://localhost/api/report-issue', {
        method: 'POST',
        body: formData,
      }),
      context: {},
      params: {},
    });

    expect(getStatus(response)).toBe(502);
  });
});
