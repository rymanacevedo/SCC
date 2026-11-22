import { readBoundedText } from '../../shared/boundedText.ts';

const MAX_JSON_BYTES_PER_CODE_UNIT = 6;
const JSON_STRUCTURE_BYTES = 1024;

export function jsonBodyLimit(maxStringLength: number) {
  return maxStringLength * MAX_JSON_BYTES_PER_CODE_UNIT + JSON_STRUCTURE_BYTES;
}

export type BoundedJson =
  | { ok: true; value: unknown }
  | { ok: false; reason: 'too_large' };

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
  return { ok: true, value: JSON.parse(text) };
}
