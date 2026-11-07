import { expect, spyOn, test } from 'bun:test';
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

test('the Worker logs a client disconnect as a cancellation, not a failure', async () => {
  const controller = new AbortController();
  const request = new Request('https://scc.example/api/summaries');
  // The test DOM's AbortController is not Bun's, so attach it after construction.
  Object.defineProperty(request, 'signal', { value: controller.signal });
  const log = spyOn(console, 'log').mockImplementation(() => {});
  const error = spyOn(console, 'error').mockImplementation(() => {});
  try {
    const worker = createWorker({
      fetch: async () => {
        controller.abort();
        throw controller.signal.reason;
      },
    });
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
