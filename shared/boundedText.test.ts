import { expect, test } from 'bun:test';
import { readBoundedText } from './boundedText.ts';

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

test('readBoundedText returns a body under the limit whole', async () => {
  const { stream } = streamOf(encode('{"prompt":'), encode('"hi"}'));
  expect(await readBoundedText(stream, 1024)).toEqual({
    text: '{"prompt":"hi"}',
    truncated: false,
  });
});

test('readBoundedText decodes multi-byte characters split across chunks', async () => {
  const bytes = encode('café ✓');
  const { stream } = streamOf(bytes.subarray(0, 4), bytes.subarray(4));
  expect((await readBoundedText(stream, 1024)).text).toBe('café ✓');
});

test('readBoundedText stops at the limit and cancels the rest of the stream', async () => {
  const { stream, wasCancelled } = streamOf(encode('abcd'), encode('efgh'));
  expect(await readBoundedText(stream, 6)).toEqual({
    text: 'abcdef',
    truncated: true,
  });
  expect(wasCancelled()).toBe(true);
});

test('readBoundedText treats a missing body as empty', async () => {
  expect(await readBoundedText(null, 10)).toEqual({
    text: '',
    truncated: false,
  });
});

test('readBoundedText cancels a body that never ends when the signal aborts', async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encode('['));
    },
    cancel() {
      cancelled = true;
    },
  });
  const controller = new AbortController();
  const read = readBoundedText(stream, 1024, controller.signal);
  controller.abort(new Error('deadline'));
  await expect(read).rejects.toThrow('deadline');
  expect(cancelled).toBe(true);
});
