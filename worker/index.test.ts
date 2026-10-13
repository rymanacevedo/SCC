import { expect, spyOn, test } from 'bun:test';
import { createWorker } from './index.ts';

test('unknown API paths return a JSON 404 Error envelope for every method', async () => {
  for (const method of ['GET', 'POST', 'OPTIONS']) {
    const response = await createWorker().fetch(
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
