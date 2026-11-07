import { expect, test } from 'bun:test';
import { FLAG_DEFAULTS } from '../shared/flags.ts';
import { loadFlags, useFlags } from './flags.ts';

test('useFlags is the defaults until loadFlags settles, then the loaded set', async () => {
  const calls: Array<{ url: string; accept: string | null }> = [];
  const fetcher = ((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      accept: new Headers(init?.headers).get('Accept'),
    });
    return Promise.resolve(
      Response.json({ flags: { unknown: true, other: 'true' } }),
    );
  }) as typeof fetch;

  const [first, second] = await Promise.all([
    loadFlags(fetcher),
    loadFlags(fetcher),
  ]);
  // Unknown keys and non-booleans never reach the client; one request per load.
  expect(first).toEqual(FLAG_DEFAULTS);
  expect(second).toBe(first);
  expect(useFlags()).toBe(first);
  expect(calls).toEqual([{ url: '/api/flags', accept: 'application/json' }]);
  await loadFlags(fetcher);
  expect(calls).toHaveLength(1);
});
