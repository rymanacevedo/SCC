import { expect, test } from 'bun:test';
import { FLAG_DEFAULTS } from '../shared/flags.ts';
import { type FlagsEnv, readFlags } from './flags.ts';

const defaults = { alpha: false, beta: false, gamma: true };

function stubBinding(values: Record<string, boolean | Error>) {
  const reads: Array<[string, boolean]> = [];
  const env: FlagsEnv = {
    FLAGS: {
      getBooleanValue: (key, defaultValue) => {
        reads.push([key, defaultValue]);
        const value = values[key];
        if (value instanceof Error) return Promise.reject(value);
        return Promise.resolve(value ?? defaultValue);
      },
    },
  };
  return { env, reads };
}

test('readFlags asks for every known flag with its schema default', async () => {
  const { env, reads } = stubBinding({ alpha: true });
  expect(await readFlags(env, defaults)).toEqual({
    alpha: true,
    beta: false,
    gamma: true,
  });
  expect(reads.toSorted()).toEqual([
    ['alpha', false],
    ['beta', false],
    ['gamma', true],
  ]);
});

test('a failing key keeps its default while the others still resolve', async () => {
  const { env } = stubBinding({
    alpha: true,
    beta: new Error('flagship down'),
    gamma: false,
  });
  expect(await readFlags(env, defaults)).toEqual({
    alpha: true,
    beta: false,
    gamma: false,
  });
});

test('the production set reads as its defaults', async () => {
  const { env, reads } = stubBinding({});
  expect(await readFlags(env)).toEqual(FLAG_DEFAULTS);
  expect(reads).toHaveLength(Object.keys(FLAG_DEFAULTS).length);
});
