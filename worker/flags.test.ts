import { expect, test } from 'bun:test';
import { FLAG_DEFAULTS, FLAG_NAMES } from '../shared/flags.ts';
import { type FlagsEnv, readFlags } from './flags.ts';

function stubBinding(value: boolean | Error): FlagsEnv & { reads: string[] } {
  const reads: string[] = [];
  return {
    reads,
    FLAGS: {
      getBooleanValue: (key, defaultValue) => {
        reads.push(key);
        if (value instanceof Error) return Promise.reject(value);
        return Promise.resolve(value || defaultValue);
      },
    },
  };
}

test('readFlags asks the binding for every known flag and nothing else', async () => {
  const env = stubBinding(true);
  const flags = await readFlags(env);
  expect(env.reads.toSorted()).toEqual([...FLAG_NAMES].toSorted());
  expect(flags).toEqual(
    Object.fromEntries(FLAG_NAMES.map((name) => [name, true])),
  );
});

test('a throwing binding leaves every flag at its default', async () => {
  expect(await readFlags(stubBinding(new Error('flagship down')))).toEqual(
    FLAG_DEFAULTS,
  );
});
