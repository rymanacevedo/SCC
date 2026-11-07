import { afterEach, describe, expect, jest, mock, test } from 'bun:test';
import {
  createAutoReportedIssue,
  createUserReportedIssue,
  GitHubIssueCreationError,
} from './github.ts';

const originalFetch = globalThis.fetch;

afterEach(() => {
  jest.useRealTimers();
  mock.restore();
  globalThis.fetch = originalFetch;
});

describe('createAutoReportedIssue', () => {
  test('does not create another issue when an open auto-reported issue has the same fingerprint', async () => {
    const fetchMock = mock(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input);

        if (url.includes('/issues?')) {
          return Response.json([
            {
              number: 24,
              body: [
                '# Auto-reported application error',
                '',
                '- Fingerprint: {"url":"https://example.com/assets/app-[hash].js","message":"Chunk failed","stackTrace":"TypeError: Chunk failed\\n    at https://example.com/assets/app-[hash].js"}',
              ].join('\n'),
            },
          ]);
        }

        return Response.json({ id: 2 }, { status: 201 });
      },
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await createAutoReportedIssue({
      repo: 'acme/scc',
      token: 'token-123',
      payload: {
        timestamp: '2026-04-27T12:00:00.000Z',
        url: 'https://example.com/assets/app-a1b2c3d4.js:12:34',
        message: 'Chunk failed',
        stackTrace:
          'TypeError: Chunk failed\n    at https://example.com/assets/app-a1b2c3d4.js:12:34',
      },
    });

    expect(result).toEqual({ deduped: true, issueNumber: 24 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('checks additional open issue pages before creating a new auto-reported issue', async () => {
    const fetchMock = mock(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = String(input);

        if (
          url.includes('/issues?') &&
          new URL(url).searchParams.get('page') === '1'
        ) {
          return Response.json(
            Array.from({ length: 100 }, (_, index) => ({
              number: index + 1,
              body: '- Fingerprint: different',
            })),
          );
        }

        if (
          url.includes('/issues?') &&
          new URL(url).searchParams.get('page') === '2'
        ) {
          return Response.json([
            {
              number: 151,
              body: [
                '# Auto-reported application error',
                '',
                '- Fingerprint: {"url":"https://example.com/assets/app-[hash].js","message":"Chunk failed","stackTrace":"TypeError: Chunk failed\\n    at https://example.com/assets/app-[hash].js"}',
              ].join('\n'),
            },
          ]);
        }

        return Response.json({ id: 2 }, { status: 201 });
      },
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await createAutoReportedIssue({
      repo: 'acme/scc',
      token: 'token-123',
      payload: {
        timestamp: '2026-04-27T12:00:00.000Z',
        url: 'https://example.com/assets/app-a1b2c3d4.js:12:34',
        message: 'Chunk failed',
        stackTrace:
          'TypeError: Chunk failed\n    at https://example.com/assets/app-a1b2c3d4.js:12:34',
      },
    });

    expect(result).toEqual({ deduped: true, issueNumber: 151 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('GitHub error snippet', () => {
  test('keeps the first 300 characters of a large multi-byte error body', async () => {
    const body = '✓'.repeat(5000);
    globalThis.fetch = mock(
      async () => new Response(body, { status: 422 }),
    ) as unknown as typeof fetch;

    const error = await createUserReportedIssue({
      repo: 'acme/scc',
      token: 'token-123',
      payload: {
        description: 'Broken',
        timestamp: '2026-04-27T12:00:00.000Z',
        url: 'https://example.com/',
      },
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(GitHubIssueCreationError);
    expect((error as GitHubIssueCreationError).status).toBe(422);
    expect((error as GitHubIssueCreationError).details).toBe(
      body.slice(0, 300),
    );
  });
});

describe('GitHub request deadline', () => {
  const telemetry = {
    timestamp: '2026-04-27T12:00:00.000Z',
    url: 'https://example.com/',
    message: 'Chunk failed',
  };

  /**
   * Stubs fetch so calls matching `hangOn` never answer, ignoring their
   * signal; the rest answer with an empty issue list. Records every call.
   */
  function hangingFetch(hangOn: (init?: RequestInit) => boolean) {
    const calls: RequestInit[] = [];
    const hung = Promise.withResolvers<void>();
    globalThis.fetch = mock(async (_input: unknown, init?: RequestInit) => {
      calls[calls.length] = init ?? {};
      if (!hangOn(init)) return Response.json([]);
      hung.resolve();
      return new Promise<Response>(() => {});
    }) as unknown as typeof fetch;
    return { calls, hung: hung.promise };
  }

  test('a user-reported issue that never answers is aborted at 10s, in one attempt', async () => {
    jest.useFakeTimers();
    const github = hangingFetch(() => true);
    const result = createUserReportedIssue({
      repo: 'acme/scc',
      token: 'token-123',
      payload: { ...telemetry, description: 'Broken' },
    }).catch((caught: unknown) => caught);

    await github.hung;
    jest.advanceTimersByTime(10_000);
    const error = await result;

    expect(error).toBeInstanceOf(GitHubIssueCreationError);
    expect((error as GitHubIssueCreationError).kind).toBe('timeout');
    expect(github.calls).toHaveLength(1);
    expect(github.calls[0]?.signal?.aborted).toBe(true);
  });

  test('a deduplication search that never answers times out without creating an issue', async () => {
    jest.useFakeTimers();
    const github = hangingFetch((init) => init?.method === 'GET');
    const result = createAutoReportedIssue({
      repo: 'acme/scc',
      token: 'token-123',
      payload: telemetry,
    }).catch((caught: unknown) => caught);

    await github.hung;
    jest.advanceTimersByTime(10_000);

    expect(await result).toMatchObject({ kind: 'timeout' });
    expect(github.calls.map((init) => init.method)).toEqual(['GET']);
  });

  test('an auto-reported issue creation that times out is attempted once', async () => {
    jest.useFakeTimers();
    const github = hangingFetch((init) => init?.method === 'POST');
    const result = createAutoReportedIssue({
      repo: 'acme/scc',
      token: 'token-123',
      payload: telemetry,
    }).catch((caught: unknown) => caught);

    await github.hung;
    jest.advanceTimersByTime(10_000);

    expect(await result).toMatchObject({ kind: 'timeout' });
    expect(github.calls.map((init) => init.method)).toEqual(['GET', 'POST']);
  });
});
