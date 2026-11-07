import { expect, mock, test } from 'bun:test';
import { createWorkerKnownAssetsLoader } from './report-assets.ts';

const ASSETS = ['/assets/index-BOZHR0Lk.js'];

test('reads report-assets.json through the ASSETS binding', async () => {
  const fetch = mock(async (_input: string, _init: { signal: AbortSignal }) =>
    Response.json(ASSETS),
  );
  const load = createWorkerKnownAssetsLoader({ ASSETS: { fetch } });
  expect([...(await load())]).toEqual(ASSETS);
  const [url, init] = fetch.mock.calls[0] ?? [];
  expect(url).toBe('https://app.invalid/report-assets.json');
  // The loader's deadline reaches the binding.
  expect(init?.signal).toBeInstanceOf(AbortSignal);
});

test('no binding, or a binding without fetch, is the empty set', async () => {
  for (const env of [{}, { ASSETS: undefined }, { ASSETS: { fetch: 'x' } }])
    expect((await createWorkerKnownAssetsLoader(env)()).size).toBe(0);
});
