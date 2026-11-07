/** The upstream services the Worker calls under a deadline. */
export type Upstream = 'provider' | 'github';

/** An upstream call ran past its deadline and was aborted. */
// Listed in KNOWN_ERROR_NAMES (shared/telemetryRedaction.ts); an unlisted name is reported as `Error`.
export class UpstreamTimeoutError extends Error {
  readonly upstream: Upstream;
  readonly timeoutMs: number;

  constructor(upstream: Upstream, timeoutMs: number) {
    super(`${upstream} call exceeded its ${timeoutMs}ms deadline.`);
    this.name = 'UpstreamTimeoutError';
    this.upstream = upstream;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Runs `run` with a signal that aborts after `timeoutMs`, or when `signal`
 * (the client's) aborts first. Settles as soon as either fires, even if the
 * upstream ignores the signal, so a hung upstream never holds the request.
 * On abort it rejects with the signal's reason: an `UpstreamTimeoutError` for
 * the deadline, the client's own reason for a disconnect.
 */
export async function withDeadline<T>(
  {
    upstream,
    timeoutMs,
    signal,
  }: { upstream: Upstream; timeoutMs: number; signal?: AbortSignal },
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const deadline = new AbortController();
  const timer = setTimeout(
    () => deadline.abort(new UpstreamTimeoutError(upstream, timeoutMs)),
    timeoutMs,
  );
  const merged = signal
    ? AbortSignal.any([signal, deadline.signal])
    : deadline.signal;
  let onAbort = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(merged.reason);
  });
  merged.addEventListener('abort', onAbort, { once: true });
  if (merged.aborted) onAbort();
  try {
    // A client already gone gets no upstream call at all.
    if (merged.aborted) return await aborted;
    return await Promise.race([run(merged), aborted]);
  } catch (error) {
    // Once aborted, the abort explains the failure, whatever the upstream threw.
    throw merged.aborted ? merged.reason : error;
  } finally {
    clearTimeout(timer);
    merged.removeEventListener('abort', onAbort);
  }
}
