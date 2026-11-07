import { expect, mock, test } from 'bun:test';
import { lazy } from './lazy.ts';

test('lazy runs init on first use only and reuses the value', () => {
  const init = mock(() => ({ id: 1 }));
  const get = lazy(init);
  expect(init).not.toHaveBeenCalled();
  const first = get();
  expect(get()).toBe(first);
  expect(init).toHaveBeenCalledTimes(1);
});

test('lazy does not cache a throw', () => {
  let calls = 0;
  const get = lazy(() => {
    calls += 1;
    throw new Error('missing config');
  });
  expect(get).toThrow('missing config');
  expect(get).toThrow('missing config');
  expect(calls).toBe(2);
});
