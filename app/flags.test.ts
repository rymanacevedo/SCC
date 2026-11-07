import { expect, test } from 'bun:test';
import { FLAGS_PATH } from '../shared/flags.ts';
import { createFlagClient } from './flags.ts';

const defaults = { alpha: false, beta: false };

function stubFetch(responses: Array<() => Promise<Response>>) {
  const calls: Array<{ url: string; accept: string | null }> = [];
  const fetcher = ((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      accept: new Headers(init?.headers).get('Accept'),
    });
    const next = responses.shift();
    if (!next) return Promise.reject(new Error('unexpected fetch'));
    return next();
  }) as typeof fetch;
  return { fetcher, calls };
}

test('current() is the defaults until a delayed load settles, then subscribers hear the set', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { fetcher, calls } = stubFetch([
    () =>
      gate.then(() =>
        Response.json({ flags: { alpha: true, beta: 'nope', other: true } }),
      ),
  ]);
  const client = createFlagClient({ defaults, fetcher });
  const seen: Array<Record<string, boolean>> = [];
  const unsubscribe = client.subscribe((flags) => seen.push(flags));

  const first = client.load();
  const second = client.load();
  expect(client.current()).toEqual(defaults);
  expect(seen).toEqual([]);

  release();
  const loaded = await first;
  expect(loaded).toEqual({ alpha: true, beta: false });
  expect(await second).toBe(loaded);
  expect(client.current()).toBe(loaded);
  expect(seen).toEqual([loaded]);
  expect(calls).toEqual([{ url: FLAGS_PATH, accept: 'application/json' }]);

  unsubscribe();
  await client.load();
  expect(calls).toHaveLength(2);
  expect(seen).toHaveLength(1);
});

test('a failed load settles to the defaults and the next load retries', async () => {
  const { fetcher, calls } = stubFetch([
    () => Promise.reject(new Error('offline')),
    () => Promise.resolve(new Response('nope', { status: 500 })),
    () => Promise.resolve(Response.json({ flags: { alpha: true } })),
  ]);
  const client = createFlagClient({ defaults, fetcher });
  expect(await client.load()).toEqual(defaults);
  expect(await client.load()).toEqual(defaults);
  expect(await client.load()).toEqual({ alpha: true, beta: false });
  expect(client.current()).toEqual({ alpha: true, beta: false });
  expect(calls).toHaveLength(3);
});

test('a throwing subscriber neither corrupts the loaded set nor stops the others', async () => {
  const { fetcher } = stubFetch([
    () => Promise.resolve(Response.json({ flags: { alpha: true } })),
  ]);
  const client = createFlagClient({ defaults, fetcher });
  const seen: Array<Record<string, boolean>> = [];
  let throws = 0;
  client.subscribe(() => {
    throws += 1;
    throw new Error('listener failed');
  });
  client.subscribe((set) => seen.push(set));

  const loaded = await client.load();
  expect(loaded).toEqual({ alpha: true, beta: false });
  expect(client.current()).toBe(loaded);
  expect(seen).toEqual([loaded]);
  expect(throws).toBe(1);
});
