import { expect, test } from 'bun:test';
import { withSignal } from '../../test/abortable-request.ts';
import { isClientAbort } from './abort.ts';

const requestWith = (signal: AbortSignal) =>
  withSignal(new Request('https://scc.example/api/summaries'), signal);

test('isClientAbort matches the abort reason or an AbortError once aborted', () => {
  const controller = new AbortController();
  const request = requestWith(controller.signal);
  const abortError = Object.assign(new Error('aborted'), {
    name: 'AbortError',
  });
  expect(isClientAbort(request, abortError)).toBe(false);
  controller.abort();
  expect(isClientAbort(request, controller.signal.reason)).toBe(true);
  expect(isClientAbort(request, abortError)).toBe(true);
});

test('isClientAbort matches a DOMException AbortError distinct from the reason', () => {
  const controller = new AbortController();
  controller.abort(new Error('client went away'));
  const providerAbort = new DOMException(
    'The operation was aborted',
    'AbortError',
  );
  expect(providerAbort).not.toBe(controller.signal.reason);
  expect(isClientAbort(requestWith(controller.signal), providerAbort)).toBe(
    true,
  );
  expect(
    isClientAbort(requestWith(controller.signal), { name: 'AbortError' }),
  ).toBe(true);
});

test('isClientAbort leaves an unrelated failure after a disconnect a failure', () => {
  const controller = new AbortController();
  controller.abort();
  expect(
    isClientAbort(requestWith(controller.signal), new Error('provider down')),
  ).toBe(false);
});
