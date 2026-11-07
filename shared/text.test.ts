import { expect, test } from 'bun:test';
import { truncateText } from './text.ts';

test('a string within the limit is returned unchanged', () => {
  expect(truncateText('abc', 3)).toBe('abc');
});

test('a string over the limit is cut to exactly the limit', () => {
  expect(truncateText('abcd', 3)).toBe('abc');
});

test('a cut that would split a surrogate pair drops the whole character', () => {
  // '😀' is two code units; a 3-unit cut lands between them.
  const cut = truncateText('ab😀c', 3);
  expect(cut).toBe('ab');
  expect(cut.isWellFormed()).toBe(true);
});

test('a cut just after a surrogate pair keeps it', () => {
  expect(truncateText('ab😀c', 4)).toBe('ab😀');
});
