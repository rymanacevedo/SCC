import { expect, test } from 'bun:test';
import { FLAG_DEFAULTS, FLAG_NAMES, resolveFlags } from './flags.ts';

test('every default is off and FLAG_NAMES lists exactly the defaults', () => {
  expect(Object.values(FLAG_DEFAULTS).every((value) => value === false)).toBe(
    true,
  );
  expect(FLAG_NAMES).toEqual(Object.keys(FLAG_DEFAULTS));
});

test('resolveFlags keeps known booleans and drops everything else', () => {
  expect(resolveFlags({})).toEqual(FLAG_DEFAULTS);
  expect(resolveFlags({ unknown: true, other: 'true' })).toEqual(FLAG_DEFAULTS);
  for (const name of FLAG_NAMES) {
    expect(resolveFlags({ [name]: true })).toEqual({
      ...FLAG_DEFAULTS,
      [name]: true,
    });
    expect(resolveFlags({ [name]: 'true' })).toEqual(FLAG_DEFAULTS);
  }
});
