/**
 * Attaches `signal` to a built Request. The test DOM's AbortController is not
 * Bun's, so the Request constructor rejects its signal. contractRequest
 * attaches `cf` the same way.
 */
export function withSignal(request: Request, signal: AbortSignal): Request {
  Object.defineProperty(request, 'signal', { value: signal });
  return request;
}
