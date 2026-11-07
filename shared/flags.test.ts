import { expect, test } from 'bun:test';
import { FLAG_DEFAULTS, parseFlagValue, resolveFlags } from './flags.ts';

test('parseFlagValue accepts booleans and the KV strings only', () => {
  expect(parseFlagValue(true)).toBe(true);
  expect(parseFlagValue(false)).toBe(false);
  expect(parseFlagValue('true')).toBe(true);
  expect(parseFlagValue('false')).toBe(false);
  for (const other of ['TRUE', '1', 'yes', '', 1, 0, null, undefined, {}]) {
    expect(parseFlagValue(other)).toBeUndefined();
  }
});

test('resolveFlags keeps known flags, parses their values and defaults the rest', () => {
  const defaults = { alpha: false, beta: false, gamma: false };
  expect(
    resolveFlags({ alpha: 'true', beta: 'maybe', unknown: true }, defaults),
  ).toEqual({ alpha: true, beta: false, gamma: false });
  expect(resolveFlags({ alpha: true }, defaults)).toEqual({
    alpha: true,
    beta: false,
    gamma: false,
  });
  expect(resolveFlags({}, defaults)).toEqual(defaults);
});

test('every default is off and resolveFlags over them is the empty set today', () => {
  expect(Object.values(FLAG_DEFAULTS).every((value) => value === false)).toBe(
    true,
  );
  expect(resolveFlags({ anything: true })).toEqual(FLAG_DEFAULTS);
});
