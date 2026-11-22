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
