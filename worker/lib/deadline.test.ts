import { afterEach, describe, expect, jest, test } from 'bun:test';
import { UpstreamTimeoutError, withDeadline } from './deadline.ts';

afterEach(() => {
  jest.useRealTimers();
});

const github = { upstream: 'github', timeoutMs: 1000 } as const;
/** An upstream that never settles and ignores its signal. */
const hang = () => new Promise<never>(() => {});

describe('withDeadline', () => {
  test('returns what the upstream answers within the deadline', async () => {
    expect(await withDeadline(github, async () => 'issue')).toBe('issue');
  });

  test('an upstream that ignores its signal still settles at the deadline', async () => {
    jest.useFakeTimers();
    let upstreamSignal: AbortSignal | undefined;
    const result = withDeadline(github, (signal) => {
      upstreamSignal = signal;
      return hang();
    }).catch((caught: unknown) => caught);

    jest.advanceTimersByTime(1000);

    const error = await result;
    expect(error).toBeInstanceOf(UpstreamTimeoutError);
    expect(error).toMatchObject({ upstream: 'github', timeoutMs: 1000 });
    expect(upstreamSignal?.aborted).toBe(true);
  });

  test('the deadline explains a failure the abort caused, whatever the upstream threw', async () => {
    jest.useFakeTimers();
    const result = withDeadline(
      github,
      (signal) =>
        new Promise<never>((_, reject) => {
          signal.addEventListener('abort', () =>
            reject(new TypeError('fetch failed')),
          );
        }),
    ).catch((caught: unknown) => caught);

    jest.advanceTimersByTime(1000);

    expect(await result).toBeInstanceOf(UpstreamTimeoutError);
  });

  test('a client disconnect before the deadline rejects with the client reason', async () => {
    const client = new AbortController();
    const reason = new DOMException('Client gone', 'AbortError');
    const result = withDeadline({ ...github, signal: client.signal }, hang);

    client.abort(reason);

    await expect(result).rejects.toBe(reason);
  });

  test('a client already gone rejects at once with its reason', async () => {
    const client = new AbortController();
    const reason = new DOMException('Client gone', 'AbortError');
    client.abort(reason);

    await expect(
      withDeadline({ ...github, signal: client.signal }, hang),
    ).rejects.toBe(reason);
  });

  test('an upstream failure before the deadline passes through unchanged', async () => {
    const failure = new Error('upstream refused');

    await expect(
      withDeadline(github, async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
  });
});
