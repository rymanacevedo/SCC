import { expect, spyOn, test } from 'bun:test';
import { withSignal } from '../test/abortable-request.ts';
import { contractRequest } from '../test/contract-request.ts';
import { createMockJsonModel } from '../test/mock-model.ts';
import {
  expectNoSensitiveValues,
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
    expect(entry.error.message).toBe(
      'Save failed for [redacted], call [redacted]',
    );
    expect(entry.error.causeMessage).toBe('https://scc.example/summary');
    expect(entry.error.name).toBe('Error');
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
