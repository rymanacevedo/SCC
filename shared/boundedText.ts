export type BoundedText = { text: string; truncated: boolean };

/**
 * Reads at most `maxBytes` of a body stream and cancels the rest, so an
 * oversized or unbounded body never has to fit in memory. When `signal`
 * aborts, the stream is cancelled, so a pending read ends at once even if
 * the body never would, and the read rejects with the signal's reason.
 */
export async function readBoundedText(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<BoundedText> {
  if (!body) return { text: '', truncated: false };
  const reader = body.getReader();
  const onAbort = () => {
    reader.cancel(signal?.reason).catch(() => {});
  };
  signal?.addEventListener('abort', onAbort, { once: true });
  if (signal?.aborted) onAbort();
  const decoder = new TextDecoder();
  let text = '';
  let remaining = maxBytes;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      signal?.throwIfAborted();
      if (done) return { text: text + decoder.decode(), truncated: false };
      if (value.byteLength > remaining) {
        text += decoder.decode(value.subarray(0, remaining));
        await reader.cancel();
        return { text, truncated: true };
      }
      remaining -= value.byteLength;
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    signal?.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
}
