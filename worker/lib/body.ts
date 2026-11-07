/** The most UTF-8 bytes JSON spends on one UTF-16 code unit: a `\uXXXX` escape. */
const MAX_JSON_BYTES_PER_CODE_UNIT = 6;
/** Room for keys, punctuation and whitespace around a body's strings. */
const JSON_STRUCTURE_BYTES = 1024;

/**
 * The Body limit for a route whose schema caps its strings at `maxStringLength`
 * code units in total. Sized for the worst-case encoding, so every body the
 * schema would accept fits, and the schema, not the byte count, refuses the rest.
 */
export function jsonBodyLimit(maxStringLength: number) {
  return maxStringLength * MAX_JSON_BYTES_PER_CODE_UNIT + JSON_STRUCTURE_BYTES;
}

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

/**
 * Reads a JSON body, or reports it too large without buffering it whole. A
 * declared Content-Length over the limit is refused before any byte is read;
 * the streamed count still holds when the header is absent or understated.
 */
export async function readBoundedJson(
  request: Request,
  maxBytes: number,
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
