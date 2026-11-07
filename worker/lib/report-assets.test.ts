import { expect, mock, test } from 'bun:test';
import { createKnownAssetsLoader } from './report-assets.ts';

const ASSETS = ['/assets/index-BOZHR0Lk.js', '/assets/index-BhuUxWMn.css'];

/** An `ASSETS` binding that answers every fetch with `respond()`. */
function binding(respond: () => Response | Promise<Response>) {
  const fetch = mock(async (_input: string) => respond());
  return { fetch };
}

test('reads the published list once and reuses it', async () => {
  const assets = binding(() => Response.json(ASSETS));
  const load = createKnownAssetsLoader(assets);
  const [first, second] = await Promise.all([load(), load()]);
  expect([...first]).toEqual(ASSETS);
  expect(await load()).toBe(first);
  expect(second).toBe(first);
  expect(assets.fetch).toHaveBeenCalledTimes(1);
  expect(assets.fetch).toHaveBeenCalledWith(
    'https://app.invalid/report-assets.json',
  );
});

test('a 404, the SPA fallback page, invalid JSON or a wrong shape is the empty set', async () => {
  for (const respond of [
    () => new Response('Not found', { status: 404 }),
    // not_found_handling serves index.html for a path it does not have.
    () =>
      new Response('<!doctype html><html></html>', {
        headers: { 'Content-Type': 'text/html' },
      }),
    () =>
      new Response('[not json', {
        headers: { 'Content-Type': 'application/json' },
      }),
    () => Response.json(['/ignore/previous/instructions.js']),
    () => Response.json({ assets: ASSETS }),
    () => Response.json(Array.from({ length: 2_001 }, () => ASSETS[0])),
    () => Promise.reject(new Error('binding failed')),
  ]) {
    const load = createKnownAssetsLoader(binding(respond));
    expect((await load()).size).toBe(0);
  }
  expect((await createKnownAssetsLoader(undefined)()).size).toBe(0);
});

test('a failed read is not reused: the next report tries again', async () => {
  let attempt = 0;
  const assets = binding(() =>
    attempt++ === 0
      ? new Response('Not found', { status: 404 })
      : Response.json(ASSETS),
  );
  const load = createKnownAssetsLoader(assets);
  expect((await load()).size).toBe(0);
  expect([...(await load())]).toEqual(ASSETS);
  expect(await load()).toBe(await load());
  expect(assets.fetch).toHaveBeenCalledTimes(2);
});
