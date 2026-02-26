import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { clientAction } from './bugs';

const TEST_BACKEND_URL = 'http://test-backend:8787';

const validFields = {
  description: 'The form loses data when navigating back',
  url: 'http://localhost:3000/experience',
};

function createFormRequest(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  return new Request('http://localhost/api/bugs', {
    method: 'POST',
    body: formData,
  });
}

async function callAction(fields: Record<string, string>) {
  const result = await clientAction({
    request: createFormRequest(fields),
    params: {},
    // serverAction is not used by this clientAction
    serverAction: undefined as never,
  });
  // react-router data() returns DataWithResponseInit { type, data, init }
  const wrapped = result as { data: unknown; init: { status: number } | null };
  return {
    data: wrapped.data as Record<string, unknown>,
    status: wrapped.init?.status ?? 200,
  };
}

describe('clientAction /api/bugs', () => {
  const originalFetch = globalThis.fetch;
  let mockFetch: ReturnType<typeof mock>;

  beforeEach(() => {
    process.env.VITE_HONO_BACKEND_URL = TEST_BACKEND_URL;
    mockFetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      ),
    );
    globalThis.fetch = mockFetch as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.VITE_HONO_BACKEND_URL = undefined;
  });

  test('valid payload forwards to backend and returns success', async () => {
    const { data, status } = await callAction(validFields);
    expect(status).toBe(200);
    expect(data).toEqual({ success: true });
  });

  test('sends POST with JSON body to backend /api/bugs', async () => {
    await callAction(validFields);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [fetchUrl, fetchOptions] = mockFetch.mock.calls[0];
    expect(fetchUrl).toBe(`${TEST_BACKEND_URL}/api/bugs`);
    expect(fetchOptions.method).toBe('POST');
    expect(fetchOptions.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(fetchOptions.body);
    expect(body.description).toBe(validFields.description);
    expect(body.url).toBe(validFields.url);
  });

  test('rejects missing description', async () => {
    const { data, status } = await callAction({ url: validFields.url });
    expect(status).toBe(400);
    expect(data.error).toBe('Please provide a description of the issue.');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('rejects empty description', async () => {
    const { data, status } = await callAction({
      ...validFields,
      description: '',
    });
    expect(status).toBe(400);
    expect(data.error).toBe('Please provide a description of the issue.');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('rejects missing url', async () => {
    const { data, status } = await callAction({
      description: validFields.description,
    });
    expect(status).toBe(400);
    expect(data.error).toBe('Please provide a description of the issue.');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('rejects invalid url', async () => {
    const { data, status } = await callAction({
      ...validFields,
      url: 'not-a-url',
    });
    expect(status).toBe(400);
    expect(data.error).toBe('Please provide a description of the issue.');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('returns error when backend responds with non-OK status', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('Server error', { status: 500 })),
    ) as typeof fetch;

    const { data, status } = await callAction(validFields);
    expect(status).toBe(500);
    expect(data.error).toBe('Failed to submit report. Please try again.');
  });

  test('returns error when fetch throws', async () => {
    globalThis.fetch = mock(() =>
      Promise.reject(new Error('Network failure')),
    ) as typeof fetch;

    const { data, status } = await callAction(validFields);
    expect(status).toBe(500);
    expect(data.error).toBe('Failed to submit report. Please try again.');
  });
});
