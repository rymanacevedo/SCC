import { expect, mock, test } from 'bun:test';
import { createKnownAssetsLoader } from './reportAssets.ts';

const ASSETS = ['/assets/index-BOZHR0Lk.js', '/assets/index-BhuUxWMn.css'];

/** A fetcher that answers every read with `respond()`. */
function fetcher(respond: () => Response | Promise<Response>) {
  return mock(async () => respond());
}

test('reads the published list once and reuses it', async () => {
  const fetchAssets = fetcher(() => Response.json(ASSETS));
  const load = createKnownAssetsLoader(fetchAssets);
  const [first, second] = await Promise.all([load(), load()]);
  expect([...first]).toEqual(ASSETS);
  expect(await load()).toBe(first);
  expect(second).toBe(first);
  expect(fetchAssets).toHaveBeenCalledTimes(1);
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
    () => Promise.reject(new Error('fetch failed')),
  ]) {
    const load = createKnownAssetsLoader(fetcher(respond));
    expect((await load()).size).toBe(0);
  }
  expect((await createKnownAssetsLoader(undefined)()).size).toBe(0);
});

test('a failed read is not reused: the next report tries again', async () => {
  let attempt = 0;
  const fetchAssets = fetcher(() =>
    attempt++ === 0
      ? new Response('Not found', { status: 404 })
      : Response.json(ASSETS),
  );
  const load = createKnownAssetsLoader(fetchAssets);
  expect((await load()).size).toBe(0);
  expect([...(await load())]).toEqual(ASSETS);
  expect(await load()).toBe(await load());
  expect(fetchAssets).toHaveBeenCalledTimes(2);
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('a stalled body is cancelled at the deadline, and the next report reads again', async () => {
  let cancelled = 0;
  const fetchAssets = mock(
    async (_signal: AbortSignal) =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('['));
          },
          cancel() {
            cancelled += 1;
          },
        }),
        { headers: { 'Content-Type': 'application/json' } },
      ),
  );
  const load = createKnownAssetsLoader(fetchAssets, 10);
  expect((await load()).size).toBe(0);
  expect(fetchAssets.mock.calls[0]?.[0].aborted).toBe(true);
  await tick();
  // The body was cancelled, so the read ended: the next report retries.
  expect(cancelled).toBe(1);
  expect((await load()).size).toBe(0);
  expect(fetchAssets).toHaveBeenCalledTimes(2);
});

test('a fetch that ignores the abort holds the only read: reports get the empty set and start no other', async () => {
  const fetchAssets = mock(
    (_signal: AbortSignal) => new Promise<Response>(() => {}),
  );
  const load = createKnownAssetsLoader(fetchAssets, 10);
  expect((await load()).size).toBe(0);
  expect(fetchAssets.mock.calls[0]?.[0].aborted).toBe(true);
  for (let index = 0; index < 5; index += 1)
    expect((await load()).size).toBe(0);
  expect(fetchAssets).toHaveBeenCalledTimes(1);
});

test('a body past its byte cap is the empty set and is cancelled', async () => {
  let cancelled = false;
  const chunk = new TextEncoder().encode(' '.repeat(64 * 1024));
  const load = createKnownAssetsLoader(
    async () =>
      new Response(
        new ReadableStream({
          pull(controller) {
            controller.enqueue(chunk);
          },
          cancel() {
            cancelled = true;
          },
        }),
        { headers: { 'Content-Type': 'application/json' } },
      ),
  );
  expect((await load()).size).toBe(0);
  expect(cancelled).toBe(true);
});
