import { expect, test } from 'bun:test';
import { createFlagReader, flagsBinding } from './flags.ts';

const defaults = { alpha: false, beta: false };

function stubKv(values: Record<string, string | null | Error>) {
  const reads: string[] = [];
  const kv = {
    get: async (name: string) => {
      reads.push(name);
      const value = values[name];
      if (value instanceof Error) throw value;
      return value ?? null;
    },
  } as unknown as KVNamespace;
  return { kv, reads };
}

test('flagsBinding finds a KV namespace and nothing else', () => {
  const { kv } = stubKv({});
  expect(flagsBinding({ FLAGS: kv })).toBe(kv);
  expect(flagsBinding({})).toBeUndefined();
  expect(flagsBinding({ FLAGS: 'not a namespace' })).toBeUndefined();
});

test('readFlags parses KV values and defaults unknown values and errors', async () => {
  const { kv, reads } = stubKv({
    alpha: 'true',
    beta: new Error('KV unavailable'),
  });
  const read = createFlagReader({ defaults });
  expect(await read({ FLAGS: kv })).toEqual({ alpha: true, beta: false });
  expect(reads.toSorted()).toEqual(['alpha', 'beta']);

  const odd = stubKv({ alpha: 'yes', beta: null });
  expect(await createFlagReader({ defaults })({ FLAGS: odd.kv })).toEqual(
    defaults,
  );
});

test('readFlags serves the defaults without a FLAGS binding', async () => {
  expect(await createFlagReader({ defaults })({})).toEqual(defaults);
});

test('readFlags caches for 30 seconds per reader', async () => {
  let clock = 1_000;
  const { kv, reads } = stubKv({ alpha: 'true' });
  const read = createFlagReader({ defaults, now: () => clock });
  const env = { FLAGS: kv };
  expect(await read(env)).toEqual({ alpha: true, beta: false });
  clock += 29_999;
  await read(env);
  expect(reads).toHaveLength(2);
  clock += 1;
  await read(env);
  expect(reads).toHaveLength(4);
  // Another reader has its own cache.
  await createFlagReader({ defaults, now: () => clock })(env);
  expect(reads).toHaveLength(6);
});
