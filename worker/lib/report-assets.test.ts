import { expect, mock, test } from 'bun:test';
import { createWorkerKnownAssetsLoader } from './report-assets.ts';

const ASSETS = ['/assets/index-BOZHR0Lk.js'];

test('reads report-assets.json through the ASSETS binding', async () => {
  const fetch = mock(async (_input: string) => Response.json(ASSETS));
  const load = createWorkerKnownAssetsLoader({ ASSETS: { fetch } });
  expect([...(await load())]).toEqual(ASSETS);
  expect(fetch).toHaveBeenCalledWith('https://app.invalid/report-assets.json');
});

test('no binding, or a binding without fetch, is the empty set', async () => {
  for (const env of [{}, { ASSETS: undefined }, { ASSETS: { fetch: 'x' } }])
    expect((await createWorkerKnownAssetsLoader(env)()).size).toBe(0);
});
