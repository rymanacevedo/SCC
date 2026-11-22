export function withSignal(request: Request, signal: AbortSignal): Request {
  Object.defineProperty(request, 'signal', { value: signal });
  return request;
}
