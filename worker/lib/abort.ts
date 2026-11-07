/**
 * True when `error` is the client's disconnect, not a failure that happened to
 * land after it. The router rethrows `signal.reason`; the provider throws an
 * AbortError from its merged signal, often a DOMException, so match by name.
 */
export function isClientAbort(request: Request, error: unknown): boolean {
  const { signal } = request;
  return (
    signal.aborted &&
    (error === signal.reason ||
      (typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'AbortError'))
  );
}
