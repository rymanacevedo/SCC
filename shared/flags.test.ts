import { expect, test } from 'bun:test';
import { FLAG_DEFAULTS, flagNames, resolveFlags } from './flags.ts';

const defaults = { alpha: false, beta: false, gamma: false };

test('resolveFlags keeps known booleans and drops everything else', () => {
  expect(
    resolveFlags({ alpha: true, beta: 'true', unknown: true }, defaults),
  ).toEqual({ alpha: true, beta: false, gamma: false });
  expect(resolveFlags({ alpha: false }, { ...defaults, alpha: true })).toEqual({
    alpha: false,
    beta: false,
    gamma: false,
  });
  expect(resolveFlags({}, defaults)).toEqual(defaults);
  expect(flagNames(defaults)).toEqual(['alpha', 'beta', 'gamma']);
});

test('every production default is off and resolves to itself', () => {
  expect(Object.values(FLAG_DEFAULTS).every((value) => value === false)).toBe(
    true,
  );
  expect(resolveFlags({ anything: true })).toEqual(FLAG_DEFAULTS);
});
