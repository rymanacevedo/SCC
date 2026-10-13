import { afterEach, expect, mock, test } from 'bun:test';

process.env.VITE_HONO_BACKEND_URL = 'http://backend.test';
const { clientAction } = await import('./errors');
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('POST /api/errors invalid shared-schema body takes the ZodError branch', async () => {
  const fetchMock = mock(async () => Response.json({ ok: true }));
  globalThis.fetch = fetchMock as typeof fetch;
  const result = await clientAction({
    request: new Request('http://localhost/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timestamp: 'invalid', url: '', message: '' }),
    }),
    params: {},
    context: {},
  });
  if (result instanceof Response)
    throw new Error('Expected validation response');
  expect(result.init?.status).toBe(400);
  expect(result.data).toMatchObject({
    errors: {
      formErrors: [],
      fieldErrors: {
        timestamp: [expect.any(String)],
        url: [expect.any(String)],
        message: [expect.any(String)],
      },
    },
  });
  expect(fetchMock).not.toHaveBeenCalled();
});
