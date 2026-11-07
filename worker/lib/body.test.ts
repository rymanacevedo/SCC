import { expect, test } from 'bun:test';
import { jsonBodyLimit, readBoundedJson } from './body.ts';

function streamOf(...chunks: Uint8Array[]) {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks.shift();
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });
  return { stream, wasCancelled: () => cancelled };
}

const encode = (text: string) => new TextEncoder().encode(text);

test('readBoundedJson parses JSON and rejects oversized bodies', async () => {
  const post = (body: BodyInit) =>
    new Request('https://scc.example/api', { method: 'POST', body });
  expect(await readBoundedJson(post('{"a":1}'), 64)).toEqual({
    ok: true,
    value: { a: 1 },
  });
  expect(await readBoundedJson(post('x'.repeat(65)), 64)).toEqual({
    ok: false,
    reason: 'too_large',
  });
  // Chunked bodies carry no length, so the streamed cap is what holds.
  const { stream } = streamOf(encode('"'), encode('x'.repeat(100)));
  expect(await readBoundedJson(post(stream), 64)).toEqual({
    ok: false,
    reason: 'too_large',
  });
  await expect(readBoundedJson(post('{'), 64)).rejects.toThrow();
});

const post = (body: BodyInit, headers?: HeadersInit) =>
  new Request('https://scc.example/api', { method: 'POST', body, headers });
// A 64-byte JSON body: the boundary the limit tests sit on.
const atLimit = `"${'x'.repeat(62)}"`;

test('readBoundedJson accepts a body of exactly the limit and refuses one byte over, with Content-Length', async () => {
  const length = (body: string) => ({ 'Content-Length': String(body.length) });
  expect(await readBoundedJson(post(atLimit, length(atLimit)), 64)).toEqual({
    ok: true,
    value: 'x'.repeat(62),
  });
  const over = `${atLimit} `;
  expect(await readBoundedJson(post(over, length(over)), 64)).toEqual({
    ok: false,
    reason: 'too_large',
  });
});

test('readBoundedJson accepts exactly the limit and refuses one byte over without Content-Length', async () => {
  const exact = streamOf(
    encode(atLimit.slice(0, 30)),
    encode(atLimit.slice(30)),
  );
  const exactRequest = post(exact.stream);
  expect(exactRequest.headers.get('Content-Length')).toBeNull();
  expect(await readBoundedJson(exactRequest, 64)).toEqual({
    ok: true,
    value: 'x'.repeat(62),
  });
  const over = streamOf(encode(atLimit), encode(' '));
  expect(await readBoundedJson(post(over.stream), 64)).toEqual({
    ok: false,
    reason: 'too_large',
  });
  expect(over.wasCancelled()).toBe(true);
});

test('readBoundedJson refuses a declared oversized body without reading it', async () => {
  let pulls = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1;
      if (pulls > 1_000) controller.close();
      else controller.enqueue(new Uint8Array(1_024));
    },
    cancel() {
      cancelled = true;
    },
  });
  expect(
    await readBoundedJson(post(stream, { 'Content-Length': '1024000' }), 64),
  ).toEqual({ ok: false, reason: 'too_large' });
  expect(cancelled).toBe(true);
  // At most the stream's own high-water-mark pull, never the declared body.
  expect(pulls).toBeLessThanOrEqual(1);
});

test('readBoundedJson trusts the streamed count when Content-Length understates the body', async () => {
  const { stream } = streamOf(encode(atLimit), encode('  '));
  expect(
    await readBoundedJson(post(stream, { 'Content-Length': '10' }), 64),
  ).toEqual({ ok: false, reason: 'too_large' });
});

test('jsonBodyLimit leaves room for the worst-case JSON encoding of its strings', () => {
  expect(jsonBodyLimit(1_000)).toBe(7_024);
  // A control character escapes to six bytes, the most any code unit takes.
  const worst = JSON.stringify({ prompt: '\u0000'.repeat(1_000) });
  expect(encode(worst).byteLength).toBeLessThanOrEqual(jsonBodyLimit(1_000));
});
