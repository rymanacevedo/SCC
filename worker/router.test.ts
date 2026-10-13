import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import { APICallError } from 'ai';
import { contractRequest } from '../test/contract-request.ts';
import { createMockJsonModel } from '../test/mock-model.ts';
import { createApiRouter } from './router.ts';

const env = {
  ALLOWED_COUNTRIES: 'US',
  OPENAI_API_KEY: 'test',
  GITHUB_REPO: 'acme/scc',
  GITHUB_TOKEN: 'test',
};
const originalFetch = globalThis.fetch;
afterEach(() => {
  mock.restore();
  globalThis.fetch = originalFetch;
});

async function assertResponse(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(
    [...response.headers.keys()].some((key) =>
      key.startsWith('access-control-'),
    ),
  ).toBe(false);
  expect(response.headers.get('Content-Type')).toContain('application/json');
  const body = (await response.json()) as Record<string, unknown>;
  if (status >= 400) expect(typeof body.error).toBe('string');
  if (status === 400) expect(Array.isArray(body.issues)).toBe(true);
  return body;
}

test('routing precedes guards: unknown paths are 404 and known routes allow POST only', async () => {
  const router = createApiRouter({});
  for (const method of ['POST', 'GET', 'OPTIONS']) {
    await assertResponse(
      await router.fetch(
        contractRequest(
          '/api/missing',
          {},
          { method, headers: { 'Sec-Fetch-Site': 'cross-site' } },
        ),
      ),
      404,
    );
  }
  for (const path of [
    '/api/summaries',
    '/api/skills',
    '/api/experience',
    '/api/errors',
    '/api/report-issue',
  ]) {
    for (const method of ['GET', 'OPTIONS', 'PUT']) {
      const response = await router.fetch(
        contractRequest(path, {}, { method }),
      );
      expect(response.headers.get('Allow')).toBe('POST');
      await assertResponse(response, 405);
    }
  }
});

test('Same-origin guard precedes geo, and geo precedes body validation', async () => {
  const router = createApiRouter(env);
  await assertResponse(
    await router.fetch(
      contractRequest(
        '/api/summaries',
        {},
        {
          country: null,
          headers: {
            'Sec-Fetch-Site': 'cross-site',
            'Content-Type': 'text/plain',
          },
        },
      ),
    ),
    403,
  );
  await assertResponse(
    await router.fetch(
      contractRequest(
        '/api/summaries',
        {},
        { country: null, headers: { 'Content-Type': 'text/plain' } },
      ),
    ),
    415,
  );
  for (const country of [null, 'XX', 'CA'])
    await assertResponse(
      await router.fetch(contractRequest('/api/summaries', {}, { country })),
      403,
    );
});

test('invalid bodies and malformed JSON carry issues before config validation', async () => {
  const router = createApiRouter({ ALLOWED_COUNTRIES: 'US' });
  for (const path of [
    '/api/summaries',
    '/api/skills',
    '/api/experience',
    '/api/errors',
    '/api/report-issue',
  ]) {
    const body = await assertResponse(
      await router.fetch(contractRequest(path, {})),
      400,
    );
    expect((body.issues as unknown[]).length).toBeGreaterThan(0);
  }
  const malformed = contractRequest('/api/summaries', {}, { body: '{' });
  await assertResponse(await router.fetch(malformed), 400);
});

test('Profanity filter rejects XML terms and multi-word roles without resolving a model', async () => {
  const resolveModel = mock(() => createMockJsonModel({}));
  const router = createApiRouter(env, { resolveModel });
  const log = spyOn(console, 'log').mockImplementation(() => {});
  for (const path of ['/api/summaries', '/api/skills', '/api/experience']) {
    for (const term of ['shit', 'Cam Model', 'OnlyFans']) {
      const body = await assertResponse(
        await router.fetch(
          contractRequest(path, { prompt: `<job>${term}</job>` }),
        ),
        400,
      );
      expect(String(body.error).toLowerCase()).toContain(term.toLowerCase());
    }
  }
  expect(resolveModel).not.toHaveBeenCalled();
  expect(log).toHaveBeenCalledWith(
    expect.objectContaining({ category: 'filtered' }),
  );
});

test('generation routes return schema-shaped JSON through the injected model', async () => {
  const summaries = [{ title: 'Developer', text: 'Builds useful software.' }];
  const recommendations = {
    expertRecommended: ['Communication'],
    other: ['Teamwork'],
  };
  for (const [path, output, modelOutput] of [
    ['/api/summaries', summaries, { summaries }],
    ['/api/skills', recommendations, recommendations],
    ['/api/experience', recommendations, recommendations],
  ] as const) {
    const model = createMockJsonModel(modelOutput);
    const router = createApiRouter(env, { resolveModel: () => model });
    expect(
      await assertResponse(
        await router.fetch(
          contractRequest(path, undefined, {
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Sec-Fetch-Site': 'same-origin',
            },
          }),
        ),
        200,
      ),
    ).toEqual(output as unknown as Record<string, unknown>);
    expect(model.doGenerateCalls).toHaveLength(1);
  }
});

test('config failures are 500 and provider APICallError is 502', async () => {
  const log = spyOn(console, 'error').mockImplementation(() => {});
  await assertResponse(
    await createApiRouter({ ALLOWED_COUNTRIES: 'US' }).fetch(
      contractRequest('/api/summaries'),
    ),
    500,
  );
  await assertResponse(
    await createApiRouter({}).fetch(contractRequest('/api/summaries')),
    500,
  );
  const model = createMockJsonModel({});
  model.doGenerate = async () => {
    throw new APICallError({
      message: 'private upstream failure',
      url: 'https://provider.example',
      requestBodyValues: {},
      statusCode: 400,
      isRetryable: false,
    });
  };
  const body = await assertResponse(
    await createApiRouter(env, { resolveModel: () => model }).fetch(
      contractRequest('/api/summaries'),
    ),
    502,
  );
  expect(body.error).toBe('Failed to generate content');
  expect(log).toHaveBeenCalledWith(
    expect.objectContaining({ category: 'provider' }),
  );
});

const report = {
  timestamp: '2026-10-13T00:00:00.000Z',
  url: 'https://scc.example/summary',
  message: 'Application failure',
  description: 'The page failed',
};
test('both reporting routes preserve GitHub payloads and return ok', async () => {
  const calls = mock(
    async (input: string | URL | Request, _init?: RequestInit) =>
      String(input).includes('?')
        ? Response.json([])
        : Response.json({ number: 1 }, { status: 201 }),
  );
  globalThis.fetch = calls as unknown as typeof fetch;
  const router = createApiRouter(env);
  for (const path of ['/api/errors', '/api/report-issue'])
    expect(
      await assertResponse(
        await router.fetch(contractRequest(path, report)),
        200,
      ),
    ).toEqual({ ok: true });
  expect(calls).toHaveBeenCalledTimes(3);
  const posts = calls.mock.calls.filter(([, init]) => init?.method === 'POST');
  expect(JSON.parse(String(posts[0]?.[1]?.body))).toMatchObject({
    labels: ['bug', 'auto-reported'],
  });
  expect(JSON.parse(String(posts[1]?.[1]?.body))).toMatchObject({
    title: 'User-reported issue',
    labels: ['bug', 'user-reported'],
  });
});

test('GitHub config failures are 500; HTTP and network failures are 502', async () => {
  spyOn(console, 'error').mockImplementation(() => {});
  for (const path of ['/api/errors', '/api/report-issue']) {
    await assertResponse(
      await createApiRouter({ ALLOWED_COUNTRIES: 'US' }).fetch(
        contractRequest(path, report),
      ),
      500,
    );
    for (const failure of ['http', 'network']) {
      globalThis.fetch = mock(async () => {
        if (failure === 'network') throw new Error('offline');
        return new Response('private detail', { status: 503 });
      }) as unknown as typeof fetch;
      const body = await assertResponse(
        await createApiRouter(env).fetch(contractRequest(path, report)),
        502,
      );
      expect(body.error).not.toContain('private detail');
    }
  }
});
