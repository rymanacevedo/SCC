import { expect, spyOn, test } from 'bun:test';
import { withSignal } from '../test/abortable-request.ts';
import { contractRequest } from '../test/contract-request.ts';
import { createMockJsonModel } from '../test/mock-model.ts';
import {
  expectNoSensitiveValues,
  SENSITIVE_KEY_SEGMENT,
  SENSITIVE_MESSAGE,
  SENSITIVE_URL,
} from '../test/sensitive-reports.ts';
import { createApiRouter } from './router.ts';
import { createWorker } from './worker.ts';

test('unknown API paths return a JSON 404 Error envelope for every method', async () => {
  for (const method of ['GET', 'POST', 'OPTIONS']) {
    const response = await createWorker(createApiRouter({})).fetch(
      new Request('https://scc.example/api/anything', { method }),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ error: 'Not found' });
  }
});

test('a thrown value that cannot be stringified still gets the JSON 500', async () => {
  const log = spyOn(console, 'error').mockImplementation(() => {});
  const unstringifiable: unknown[] = [
    Object.create(null),
    {
      toString() {
        throw new Error('toString threw');
      },
    },
    {
      [Symbol.toPrimitive]() {
        throw new Error('toPrimitive threw');
      },
    },
    Object.defineProperty(new Error('x'), 'message', {
      get() {
        throw new Error('getter threw');
      },
    }),
  ];
  try {
    for (const thrown of unstringifiable) {
      log.mockClear();
      const worker = createWorker({
        fetch: async () => {
          throw thrown;
        },
      });
      const response = await worker.fetch(
        new Request('https://scc.example/api/anything'),
      );
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Internal error' });
      expect(log).toHaveBeenCalledTimes(1);
    }
    expect(log.mock.calls[0]?.[0]).toMatchObject({
      error: { message: '[error unreadable]' },
    });
  } finally {
    log.mockRestore();
  }
});

test('the Worker converts thrown errors to a 500 without leaking details', async () => {
  const log = spyOn(console, 'error').mockImplementation(() => {});
  try {
    const worker = createWorker({
      fetch: async () => {
        throw new Error('private provider details');
      },
    });
    const response = await worker.fetch(
      new Request('https://scc.example/api/anything'),
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Internal error' });
    expect(log).toHaveBeenCalled();
  } finally {
    log.mockRestore();
  }
});

test('the Worker redacts an unhandled error before logging it', async () => {
  const log = spyOn(console, 'error').mockImplementation(() => {});
  try {
    const worker = createWorker({
      fetch: async () => {
        throw new Error(SENSITIVE_MESSAGE, { cause: new Error(SENSITIVE_URL) });
      },
    });
    await worker.fetch(new Request('https://scc.example/api/anything'));
    const entry = log.mock.calls[0]?.[0] as { error: Record<string, unknown> };
    expectNoSensitiveValues(JSON.stringify(entry));
    expect(entry.error).toMatchObject({
      name: 'Error',
      message: `[message omitted: ${SENSITIVE_MESSAGE.length} characters]`,
      causeName: 'Error',
    });
  } finally {
    log.mockRestore();
  }
});

test('a client disconnect logs its path sanitized, like every other log sink', async () => {
  const controller = new AbortController();
  controller.abort();
  const request = withSignal(
    new Request(
      `https://scc.example/api/x/${SENSITIVE_KEY_SEGMENT}/5551234567`,
    ),
    controller.signal,
  );
  const log = spyOn(console, 'log').mockImplementation(() => {});
  try {
    const worker = createWorker({
      fetch: async () => {
        throw controller.signal.reason;
      },
    });
    expect((await worker.fetch(request)).status).toBe(499);
    expect(log).toHaveBeenCalledWith({
      category: 'client_aborted',
      path: '/api/x/[redacted]/[redacted]',
    });
  } finally {
    log.mockRestore();
  }
});

test('the Worker logs a client disconnect during generation as a cancellation, not a failure', async () => {
  const controller = new AbortController();
  const model = createMockJsonModel({});
  model.doGenerate = async ({ abortSignal }) => {
    controller.abort();
    abortSignal?.throwIfAborted();
    throw new Error('provider ignored the abort');
  };
  const request = withSignal(
    contractRequest('/api/summaries'),
    controller.signal,
  );
  const log = spyOn(console, 'log').mockImplementation(() => {});
  const error = spyOn(console, 'error').mockImplementation(() => {});
  try {
    const worker = createWorker(
      createApiRouter(
        { ALLOWED_COUNTRIES: 'US', OPENAI_API_KEY: 'test' },
        { resolveModel: () => model },
      ),
    );
    const response = await worker.fetch(request);
    expect(response.status).toBe(499);
    expect(log).toHaveBeenCalledWith({
      category: 'client_aborted',
      path: '/api/summaries',
    });
    expect(error).not.toHaveBeenCalled();
  } finally {
    log.mockRestore();
    error.mockRestore();
  }
});
