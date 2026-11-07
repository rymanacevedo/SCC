/**
 * True when `error` is the client's disconnect, not a failure that happened to
 * land after it. The router rethrows `signal.reason`; the provider throws an
 * AbortError from the merged signal.
 */
export function isClientAbort(request: Request, error: unknown): boolean {
  const { signal } = request;
  return (
    signal.aborted &&
    (error === signal.reason ||
      (error instanceof Error && error.name === 'AbortError'))
  );
}
