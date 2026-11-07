import { expect, test } from 'bun:test';
import { createFlagClient, FLAGS_URL } from './flags.ts';

const defaults = { alpha: false, beta: false };

function stubFetch(responses: Array<() => Response | Error>) {
  const calls: Array<{ url: string; accept: string | null }> = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      accept: new Headers(init?.headers).get('Accept'),
    });
    const next = responses.shift();
    if (!next) throw new Error('unexpected fetch');
    const result = next();
    if (result instanceof Error) throw result;
    return result;
  }) as typeof fetch;
  return { fetcher, calls };
}

test('getFlags is the defaults until loadFlags settles, then the loaded set', async () => {
  const { fetcher, calls } = stubFetch([
    () => Response.json({ flags: { alpha: true, beta: 'nope', other: true } }),
  ]);
  const client = createFlagClient({ defaults, fetcher });
  expect(client.current()).toEqual(defaults);
  const [first, second] = await Promise.all([client.load(), client.load()]);
  expect(first).toEqual({ alpha: true, beta: false });
  expect(second).toBe(first);
  expect(client.current()).toBe(first);
  expect(calls).toEqual([{ url: FLAGS_URL, accept: 'application/json' }]);
  await client.load();
  expect(calls).toHaveLength(1);
});

test('a failed load settles to the defaults and the next load retries', async () => {
  const { fetcher, calls } = stubFetch([
    () => new Error('offline'),
    () => new Response('nope', { status: 500 }),
    () => Response.json({ flags: { alpha: true } }),
  ]);
  const client = createFlagClient({ defaults, fetcher });
  expect(await client.load()).toEqual(defaults);
  expect(await client.load()).toEqual(defaults);
  expect(await client.load()).toEqual({ alpha: true, beta: false });
  expect(client.current()).toEqual({ alpha: true, beta: false });
  expect(calls).toHaveLength(3);
});
