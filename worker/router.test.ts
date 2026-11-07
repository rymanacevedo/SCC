import { afterEach, expect, jest, mock, spyOn, test } from 'bun:test';
import { APICallError } from 'ai';
import {
  ERROR_TELEMETRY_MAX_LENGTH,
  sanitizeErrorTelemetry,
  sanitizeUserIssueReport,
  USER_ISSUE_REPORT_MAX_LENGTH,
} from '../shared/errorReporting.ts';
import { MAX_PROMPT_LENGTH } from '../shared/schemas/generation.ts';
import { withSignal } from '../test/abortable-request.ts';
import { contractRequest } from '../test/contract-request.ts';
import { createMockJsonModel } from '../test/mock-model.ts';
import {
  expectNoSensitiveValues,
  KNOWN_TEST_ASSETS,
  SENSITIVE_DESCRIPTION,
  SENSITIVE_MESSAGE,
  SENSITIVE_STACK,
  SENSITIVE_URL,
} from '../test/sensitive-reports.ts';
import { jsonBodyLimit } from './lib/body.ts';
import { createApiRouter } from './router.ts';

const env = {
  ALLOWED_COUNTRIES: 'US',
  OPENAI_API_KEY: 'test',
  GITHUB_REPO: 'acme/scc',
  GITHUB_TOKEN: 'test',
};
const originalFetch = globalThis.fetch;
afterEach(() => {
  jest.useRealTimers();
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
  if (status === 400)
    expect(body.issues).toEqual({
      formErrors: expect.any(Array),
      fieldErrors: expect.any(Object),
    });
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
    expect(
      Object.keys((body.issues as { fieldErrors: object }).fieldErrors).length,
    ).toBeGreaterThan(0);
  }
  const malformed = contractRequest('/api/summaries', {}, { body: '{' });
  expect(
    (await assertResponse(await router.fetch(malformed), 400)).issues,
  ).toEqual({ formErrors: ['Invalid JSON body'], fieldErrors: {} });
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

test('generated output at its limits is returned; one item or character over is a 502', async () => {
  const log = spyOn(console, 'error').mockImplementation(() => {});
  const generate = (path: string, output: unknown) =>
    createApiRouter(env, {
      resolveModel: () => createMockJsonModel(output),
    }).fetch(contractRequest(path));
  const items = (count: number, length = 10) =>
    Array.from({ length: count }, () => 'x'.repeat(length));
  const summaries = (count: number, length = 10) =>
    items(count, length).map((text) => ({ title: text, text }));
  // [path, model output at the limit, its route response, model outputs over it]
  const cases = [
    [
      '/api/skills',
      { expertRecommended: items(50, 2_000), other: items(50, 2_000) },
      undefined,
      [
        { expertRecommended: items(51), other: [] },
        { expertRecommended: [], other: items(1, 2_001) },
      ],
    ],
    [
      '/api/experience',
      { expertRecommended: items(50, 2_000), other: items(50, 2_000) },
      undefined,
      [
        { expertRecommended: [], other: items(51) },
        { expertRecommended: items(1, 2_001), other: [] },
      ],
    ],
    [
      '/api/summaries',
      { summaries: summaries(50, 2_000) },
      summaries(50, 2_000),
      [{ summaries: summaries(51) }, { summaries: summaries(1, 2_001) }],
    ],
  ] as const;
  for (const [path, atLimit, response, overLimit] of cases) {
    const expected: unknown = response ?? atLimit;
    expect(await assertResponse(await generate(path, atLimit), 200)).toEqual(
      expected as Record<string, unknown>,
    );
    for (const output of overLimit) {
      const body = await assertResponse(await generate(path, output), 502);
      expect(body.error).toBe('Failed to generate content');
    }
  }
  expect(log).toHaveBeenCalledTimes(6);
  expect(log).toHaveBeenCalledWith(
    expect.objectContaining({ category: 'generated_output_limit' }),
  );
});

test('a provider that stays rate-limited through the retry is a 502 logged as provider with its status', async () => {
  const log = spyOn(console, 'error').mockImplementation(() => {});
  const model = createMockJsonModel({});
  let attempts = 0;
  model.doGenerate = async () => {
    attempts += 1;
    throw new APICallError({
      message: 'rate limited',
      url: 'https://provider.example',
      requestBodyValues: {},
      statusCode: 429,
      // Keeps the SDK's backoff short so the test stays fast.
      responseHeaders: { 'retry-after-ms': '1' },
      isRetryable: true,
    });
  };
  await assertResponse(
    await createApiRouter(env, { resolveModel: () => model }).fetch(
      contractRequest('/api/summaries'),
    ),
    502,
  );
  expect(attempts).toBe(2);
  expect(log).toHaveBeenCalledWith(
    expect.objectContaining({
      category: 'provider',
      providerStatus: 429,
      isRetryable: true,
      attempts: 2,
    }),
  );
});

test('a generation route answers 504 when the model never answers within the deadline', async () => {
  const log = spyOn(console, 'error').mockImplementation(() => {});
  jest.useFakeTimers();
  const model = createMockJsonModel({});
  const started = Promise.withResolvers<void>();
  model.doGenerate = () => {
    started.resolve();
    return new Promise(() => {});
  };
  const response = createApiRouter(env, { resolveModel: () => model }).fetch(
    contractRequest('/api/skills'),
  );
  await started.promise;
  jest.advanceTimersByTime(45_000);
  const body = await assertResponse(await response, 504);
  expect(body.error).toBe('Failed to generate content');
  expect(log).toHaveBeenCalledWith(
    expect.objectContaining({
      route: '/api/skills',
      category: 'timeout',
      upstream: 'provider',
      timeoutMs: 45_000,
    }),
  );
});

test.each([
  ['truncated JSON', '{"summaries":[{"title":"Dev'],
  // A reasoning model can spend the whole budget before writing any text.
  ['no text at all', ''],
])(
  'a generation cut off at its output-token limit with %s is a 502 logged as token_limit',
  async (_case, text) => {
    const log = spyOn(console, 'error').mockImplementation(() => {});
    const model = createMockJsonModel({});
    model.doGenerate = async () => ({
      content: text ? [{ type: 'text', text }] : [],
      finishReason: { unified: 'length', raw: 'length' },
      usage: {
        inputTokens: {
          total: 10,
          noCache: 10,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: { total: 6000, text: 6000, reasoning: undefined },
      },
      warnings: [],
    });
    await assertResponse(
      await createApiRouter(env, { resolveModel: () => model }).fetch(
        contractRequest('/api/summaries'),
      ),
      502,
    );
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        route: '/api/summaries',
        category: 'token_limit',
        maxOutputTokens: 6000,
        outputTokens: 6000,
      }),
    );
  },
);

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

test('/api/errors keeps only the asset files the ASSETS binding publishes, read once', async () => {
  const bodies: string[] = [];
  globalThis.fetch = mock(
    async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).includes('?')) return Response.json([]);
      bodies.push(String(init?.body));
      return Response.json({ number: 1 }, { status: 201 });
    },
  ) as unknown as typeof fetch;
  const published = ['/assets/index-BOZHR0Lk.js'];
  const assets = mock(async (_input: string) => Response.json(published));
  const router = createApiRouter({ ...env, ASSETS: { fetch: assets } });
  const stackTrace = [
    'TypeError: x',
    '    at render (https://scc.example/assets/index-BOZHR0Lk.js:1:2)',
    '    at password_correcthorse (https://scc.example/assets/password_correcthorse-abcdef12.js:3:4)',
  ].join('\n');
  for (let index = 0; index < 2; index += 1)
    await assertResponse(
      await router.fetch(
        contractRequest(
          '/api/errors',
          // The browser's pass, with the same published list.
          sanitizeErrorTelemetry(
            { ...report, stackTrace },
            { knownAssets: new Set(published) },
          ),
        ),
      ),
      200,
    );
  expect(assets).toHaveBeenCalledTimes(1);
  const body = JSON.parse(bodies[0] ?? '{}').body as string;
  expectNoSensitiveValues(body);
  expect(body).toContain(
    [
      'TypeError',
      '    at <anonymous> (https://app.invalid/assets/index-BOZHR0Lk.js:1:2)',
      '    at <anonymous> (https://app.invalid/[redacted]:3:4)',
    ].join('\n'),
  );
});

test('a browser-sanitized report from a dev URL with an IP host is accepted by both routes', async () => {
  globalThis.fetch = mock(async (input: string | URL | Request) =>
    String(input).includes('?')
      ? Response.json([])
      : Response.json({ number: 1 }, { status: 201 }),
  ) as unknown as typeof fetch;
  const router = createApiRouter(env);
  const fields = {
    timestamp: '2026-10-13T00:00:00.000Z',
    url: 'http://127.0.0.1:5173/info?step=2',
  };
  const telemetry = sanitizeErrorTelemetry(
    { ...fields, message: 'Broken' },
    { knownAssets: KNOWN_TEST_ASSETS },
  );
  const report = sanitizeUserIssueReport(fields);
  expect(report.url).toBe('https://app.invalid/info');
  for (const [path, body] of [
    ['/api/errors', telemetry],
    ['/api/report-issue', report],
  ] as const)
    expect(
      await assertResponse(
        await router.fetch(contractRequest(path, body)),
        200,
      ),
    ).toEqual({ ok: true });
});

test("an older client's report with a description is accepted, and the description is dropped", async () => {
  const calls = mock(
    async (_input: string | URL | Request, _init?: RequestInit) =>
      Response.json({ number: 1 }, { status: 201 }),
  );
  globalThis.fetch = calls as unknown as typeof fetch;
  const response = await createApiRouter(env).fetch(
    contractRequest('/api/report-issue', {
      timestamp: '2026-10-13T00:00:00.000Z',
      url: 'https://scc.example/summary',
      description: SENSITIVE_DESCRIPTION,
    }),
  );
  expect(await assertResponse(response, 200)).toEqual({ ok: true });
  const sent = String(calls.mock.calls[0]?.[1]?.body);
  expectNoSensitiveValues(sent);
  expect(JSON.parse(sent).body).not.toContain('Description');
});

test('a browser-sanitized report from an over-limit URL of many segments is accepted', async () => {
  globalThis.fetch = mock(async () =>
    Response.json({ number: 1 }, { status: 201 }),
  ) as unknown as typeof fetch;
  const report = sanitizeUserIssueReport({
    timestamp: '2026-10-13T00:00:00.000Z',
    url: `https://scc.example/${'segment/'.repeat(400)}end`,
  });
  expect(report.url).not.toContain('truncated');
  expect(
    await assertResponse(
      await createApiRouter(env).fetch(
        contractRequest('/api/report-issue', report),
      ),
      200,
    ),
  ).toEqual({ ok: true });
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

test('report route failure logs carry route patterns, redacted and truncated', async () => {
  const log = spyOn(console, 'error').mockImplementation(() => {});
  const sensitiveReport = {
    timestamp: '2026-10-13T00:00:00.000Z',
    url: SENSITIVE_URL,
    message: SENSITIVE_MESSAGE,
    stackTrace: SENSITIVE_STACK,
    description: SENSITIVE_DESCRIPTION,
  };
  for (const path of ['/api/errors', '/api/report-issue']) {
    for (const failure of ['http', 'network']) {
      log.mockClear();
      globalThis.fetch = mock(async () => {
        if (failure === 'network')
          throw new Error(`${SENSITIVE_MESSAGE} ${'word '.repeat(1_000)}`);
        return new Response(
          `Bad credentials for jane.doe@example.com token=abc123`,
          { status: 401 },
        );
      }) as unknown as typeof fetch;
      await assertResponse(
        await createApiRouter(env).fetch(
          contractRequest(path, sensitiveReport),
        ),
        502,
      );
      expect(log).toHaveBeenCalledTimes(1);
      const entry = log.mock.calls[0]?.[0] as Record<string, unknown>;
      const output = JSON.stringify(entry);
      expectNoSensitiveValues(output);
      expect(entry.url).toBe('https://app.invalid/summary');
      expect(entry.category).toBe(`github_${failure}`);
      if (failure === 'network') {
        expect(entry.causeName).toBe('Error');
      } else {
        expect(entry.githubStatus).toBe(401);
        expect(entry).not.toHaveProperty('githubResponseSnippet');
      }
      expect(entry.message).toMatch(/^\[message omitted: \d+ characters\]$/);
      expect(String(entry.stack)).toContain('GitHubIssueCreationError');
    }
  }
});

test('a GitHub call that never answers is a 502 logged as github_timeout, with one attempt', async () => {
  const log = spyOn(console, 'error').mockImplementation(() => {});
  jest.useFakeTimers();
  for (const path of ['/api/errors', '/api/report-issue']) {
    const hung = Promise.withResolvers<void>();
    const calls = mock(() => {
      hung.resolve();
      return new Promise<Response>(() => {});
    });
    globalThis.fetch = calls as unknown as typeof fetch;
    const response = createApiRouter(env).fetch(contractRequest(path, report));
    await hung.promise;
    jest.advanceTimersByTime(10_000);
    await assertResponse(await response, 502);
    expect(calls).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenLastCalledWith(
      expect.objectContaining({ route: path, category: 'github_timeout' }),
    );
  }
});

test('GET /api/flags returns every known flag and rejects other methods', async () => {
  const router = createApiRouter({});
  const response = await router.fetch(
    new Request('https://example.com/api/flags', { method: 'GET' }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toEqual({ flags: {} });
  for (const method of ['POST', 'PUT', 'OPTIONS']) {
    const rejected = await router.fetch(
      new Request('https://example.com/api/flags', { method }),
    );
    expect(rejected.status).toBe(405);
    expect(rejected.headers.get('Allow')).toBe('GET');
  }
});

// Each route's Body limit, in bytes; body.test.ts pins the jsonBodyLimit formula.
const bodyLimits = {
  '/api/summaries': jsonBodyLimit(MAX_PROMPT_LENGTH),
  '/api/errors': jsonBodyLimit(ERROR_TELEMETRY_MAX_LENGTH),
  '/api/report-issue': jsonBodyLimit(USER_ISSUE_REPORT_MAX_LENGTH),
} as const;
/** A valid body padded with trailing JSON whitespace to exactly `bytes`. */
const paddedBody = (payload: unknown, bytes: number) => {
  const json = JSON.stringify(payload);
  return json + ' '.repeat(bytes - json.length);
};
const streamed = (text: string) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      const bytes = new TextEncoder().encode(text);
      for (let start = 0; start < bytes.length; start += 16_384)
        controller.enqueue(bytes.subarray(start, start + 16_384));
      controller.close();
    },
  });

test('each route accepts a body of exactly its limit and refuses one byte over with 413', async () => {
  globalThis.fetch = mock(async (input: string | URL | Request) =>
    String(input).includes('?')
      ? Response.json([])
      : Response.json({ number: 1 }, { status: 201 }),
  ) as unknown as typeof fetch;
  const resolveModel = mock(() => createMockJsonModel({ summaries: [] }));
  const router = createApiRouter(env, { resolveModel });
  const payloads = {
    '/api/summaries': { prompt: '<job>Software Developer</job>' },
    '/api/errors': report,
    '/api/report-issue': report,
  };
  for (const [path, limit] of Object.entries(bodyLimits)) {
    const payload = payloads[path as keyof typeof payloads];
    const exact = paddedBody(payload, limit);
    const over = paddedBody(payload, limit + 1);
    await assertResponse(
      await router.fetch(contractRequest(path, {}, { body: exact })),
      200,
    );
    // Content-Length declared; neither the schema nor the model is reached.
    expect(
      (
        await assertResponse(
          await router.fetch(
            contractRequest(
              path,
              {},
              {
                body: over,
                headers: { 'Content-Length': String(over.length) },
              },
            ),
          ),
          413,
        )
      ).error,
    ).toBe('Request body too large');
    // No Content-Length: the streamed byte count holds on both sides of the limit.
    const exactChunked = contractRequest(path, {}, { body: streamed(exact) });
    expect(exactChunked.headers.get('Content-Length')).toBeNull();
    await assertResponse(await router.fetch(exactChunked), 200);
    const chunked = contractRequest(path, {}, { body: streamed(over) });
    expect(chunked.headers.get('Content-Length')).toBeNull();
    await assertResponse(await router.fetch(chunked), 413);
  }
  expect(resolveModel).toHaveBeenCalledTimes(1);
});

test('a prompt over its cap is a 400 validation failure, not a model call', async () => {
  const resolveModel = mock(() => createMockJsonModel({}));
  const body = await assertResponse(
    await createApiRouter(env, { resolveModel }).fetch(
      contractRequest('/api/summaries', {
        prompt: 'x'.repeat(MAX_PROMPT_LENGTH + 1),
      }),
    ),
    400,
  );
  expect(
    (body.issues as { fieldErrors: Record<string, unknown> }).fieldErrors
      .prompt,
  ).toBeDefined();
  expect(resolveModel).not.toHaveBeenCalled();
});

test('the model is resolved once per router and reused across generation routes', async () => {
  const resolveModel = mock(() => createMockJsonModel({ summaries: [] }));
  const router = createApiRouter(env, { resolveModel });
  for (let i = 0; i < 3; i += 1) {
    await assertResponse(
      await router.fetch(contractRequest('/api/summaries')),
      200,
    );
  }
  expect(resolveModel).toHaveBeenCalledTimes(1);
});

test('a client disconnect aborts the provider call', async () => {
  const controller = new AbortController();
  const model = createMockJsonModel({});
  let providerSignal: AbortSignal | undefined;
  model.doGenerate = async ({ abortSignal }) => {
    providerSignal = abortSignal;
    controller.abort();
    abortSignal?.throwIfAborted();
    throw new Error('provider ignored the abort');
  };
  const request = withSignal(
    contractRequest('/api/summaries'),
    controller.signal,
  );
  const error = spyOn(console, 'error').mockImplementation(() => {});
  // The router rethrows the abort; the Worker entry turns it into a 499.
  await expect(
    createApiRouter(env, { resolveModel: () => model }).fetch(request),
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(providerSignal?.aborted).toBe(true);
  // The route error middleware rethrows instead of logging a failure.
  expect(error).not.toHaveBeenCalled();
});
