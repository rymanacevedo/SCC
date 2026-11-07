/** Upper bound for any `/api/*` JSON body, well above a real resume prompt. */
export const MAX_JSON_BODY_BYTES = 1024 * 1024;

export type BoundedText = { text: string; truncated: boolean };

/**
 * Reads at most `maxBytes` of a body stream and cancels the rest, so an
 * oversized or unbounded body never has to fit in Worker memory.
 */
export async function readBoundedText(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<BoundedText> {
  if (!body) return { text: '', truncated: false };
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let remaining = maxBytes;
  try {
    for (;;) {
      const { done, value } = await reader.read();
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
    reader.releaseLock();
  }
}

export type BoundedJson =
  | { ok: true; value: unknown }
  | { ok: false; reason: 'too_large' };

/** Reads a JSON body, or reports it too large without buffering it whole. */
export async function readBoundedJson(
  request: Request,
  maxBytes = MAX_JSON_BODY_BYTES,
): Promise<BoundedJson> {
  const declared = Number(request.headers.get('Content-Length'));
  if (declared > maxBytes) {
    await request.body?.cancel();
    return { ok: false, reason: 'too_large' };
  }
  const { text, truncated } = await readBoundedText(request.body, maxBytes);
  if (truncated) return { ok: false, reason: 'too_large' };
  // JSON.parse throws on malformed input; callers map that to a 400.
  return { ok: true, value: JSON.parse(text) };
}
