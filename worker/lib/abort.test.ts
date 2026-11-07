import { expect, test } from 'bun:test';
import { isClientAbort } from './abort.ts';

function requestWith(signal: AbortSignal) {
  const request = new Request('https://scc.example/api/summaries');
  // The test DOM's AbortController is not Bun's, so attach it after construction.
  Object.defineProperty(request, 'signal', { value: signal });
  return request;
}

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

test('isClientAbort leaves an unrelated failure after a disconnect a failure', () => {
  const controller = new AbortController();
  controller.abort();
  expect(
    isClientAbort(requestWith(controller.signal), new Error('provider down')),
  ).toBe(false);
});
