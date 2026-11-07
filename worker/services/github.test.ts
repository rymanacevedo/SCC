import { afterEach, describe, expect, jest, mock, test } from 'bun:test';
import {
  buildTelemetryFingerprint,
  type ErrorTelemetryPayload,
} from '../../shared/errorReporting.ts';
import {
  buildAutoReportedIssueBody,
  createAutoReportedIssue,
  createUserReportedIssue,
  GITHUB_ISSUE_BODY_MAX,
  GitHubIssueCreationError,
  issueFingerprint,
} from './github.ts';

const originalFetch = globalThis.fetch;

afterEach(() => {
  jest.useRealTimers();
  mock.restore();
  globalThis.fetch = originalFetch;
});

const auth = { repo: 'acme/scc', token: 'token-123' };
/** The body GitHub holds for an issue auto-reported from `payload`. */
const filedBody = async (payload: ErrorTelemetryPayload) =>
  buildAutoReportedIssueBody(payload, await issueFingerprint(payload));
/** The body an issue auto-reported from `payload` held before the digest. */
const legacyFiledBody = (payload: ErrorTelemetryPayload) =>
  [
    '# Auto-reported application error',
    '',
    `- Fingerprint: ${buildTelemetryFingerprint(payload)}`,
    `- Timestamp: ${payload.timestamp}`,
    `- URL: ${payload.url}`,
    `- Message: ${payload.message}`,
    '',
    '## Stack trace',
    '```',
    payload.stackTrace ?? 'No stack trace available.',
    '```',
  ].join('\n');
/** Serves `pages` of open issues, then accepts any created issue. */
function githubWith(...pages: { number: number; body: string }[][]) {
  const fetchMock = mock(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (!url.includes('/issues?'))
      return Response.json({ id: 2 }, { status: 201 });
    const page = Number(new URL(url).searchParams.get('page'));
    return Response.json(pages[page - 1] ?? []);
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const chunkFailure = {
  timestamp: '2026-04-27T12:00:00.000Z',
  url: 'https://example.com/assets/app-a1b2c3d4.js:12:34',
  message: 'Chunk failed',
  stackTrace:
    'TypeError: Chunk failed\n    at https://example.com/assets/app-a1b2c3d4.js:12:34',
};
// The same failure from another build: a new asset hash and stack coordinates.
const chunkFailureNextBuild = {
  ...chunkFailure,
  timestamp: '2026-04-28T09:00:00.000Z',
  url: 'https://example.com/assets/app-ffee9988.js:1:2',
  stackTrace:
    'TypeError: Chunk failed\n    at https://example.com/assets/app-ffee9988.js:1:2',
};

describe('issueFingerprint', () => {
  test('is the SHA-256 hex digest of the telemetry fingerprint', async () => {
    expect(
      await issueFingerprint({
        timestamp: '2026-04-27T12:00:00.000Z',
        url: 'https://example.com/',
        message: 'Broken',
      }),
    ).toBe('649d60c2ca005780376ea10c2dc41367ce5ddd6ceaee41c580c028d66c1d0809');
  });
});

describe('createAutoReportedIssue', () => {
  test('does not create another issue when an open auto-reported issue has the same fingerprint', async () => {
    const fetchMock = githubWith([
      { number: 24, body: await filedBody(chunkFailureNextBuild) },
    ]);

    const result = await createAutoReportedIssue({
      ...auth,
      payload: chunkFailure,
    });

    expect(result).toEqual({ deduped: true, issueNumber: 24 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('checks additional open issue pages before creating a new auto-reported issue', async () => {
    const fetchMock = githubWith(
      Array.from({ length: 100 }, (_, index) => ({
        number: index + 1,
        body: '- Fingerprint: different',
      })),
      [{ number: 151, body: await filedBody(chunkFailureNextBuild) }],
    );

    const result = await createAutoReportedIssue({
      ...auth,
      payload: chunkFailure,
    });

    expect(result).toEqual({ deduped: true, issueNumber: 151 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('dedupes against an open issue filed with the legacy raw-JSON fingerprint', async () => {
    const fetchMock = githubWith([
      { number: 31, body: legacyFiledBody(chunkFailureNextBuild) },
    ]);

    const result = await createAutoReportedIssue({
      ...auth,
      payload: chunkFailure,
    });

    expect(result).toEqual({ deduped: true, issueNumber: 31 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('reports that differ only deep in a long stack trace are not deduped together', async () => {
    // Backslashes escape to two characters, so these stacks, at the 16,000
    // limit, differ only past the first 32,000 characters of the fingerprint JSON.
    const stack = (last: string) => `${'\\'.repeat(15_999)}${last}`;
    const first = { ...chunkFailure, stackTrace: stack('A') };
    const second = { ...chunkFailure, stackTrace: stack('B') };
    const json = buildTelemetryFingerprint(first);
    expect(json.slice(0, 32_000)).toBe(
      buildTelemetryFingerprint(second).slice(0, 32_000),
    );
    expect(json).not.toBe(buildTelemetryFingerprint(second));
    expect(await issueFingerprint(first)).not.toBe(
      await issueFingerprint(second),
    );

    const fetchMock = githubWith([{ number: 9, body: await filedBody(first) }]);
    expect(await createAutoReportedIssue({ ...auth, payload: second })).toEqual(
      { id: 2 },
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('GitHub issue body size', () => {
  // U+0001 passes every field limit yet JSON-escapes to six characters.
  const worstCase = {
    timestamp: '2026-04-27T12:00:00.000Z',
    url: '\u0001'.repeat(2_048),
    message: '\u0001'.repeat(1_000),
    stackTrace: '\u0001'.repeat(16_000),
  };

  test('a worst-case escaped auto-reported issue body stays under the GitHub limit and still dedupes', async () => {
    const body = await filedBody(worstCase);
    expect(GITHUB_ISSUE_BODY_MAX).toBe(65_536);
    expect(body.length).toBeLessThanOrEqual(GITHUB_ISSUE_BODY_MAX);
    expect(body).toContain(worstCase.stackTrace);

    githubWith([{ number: 7, body }]);
    expect(
      await createAutoReportedIssue({ ...auth, payload: worstCase }),
    ).toEqual({ deduped: true, issueNumber: 7 });
  });

  test('every issue body sent to GitHub stays under its limit', async () => {
    const sent: string[] = [];
    globalThis.fetch = mock(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes('/issues?')) return Response.json([]);
        sent.push(JSON.parse(String(init?.body)).body);
        return Response.json({ id: 2 }, { status: 201 });
      },
    ) as unknown as typeof fetch;
    await createAutoReportedIssue({ ...auth, payload: worstCase });
    await createUserReportedIssue({
      ...auth,
      payload: {
        description: '\u0001'.repeat(10_000),
        timestamp: worstCase.timestamp,
        url: `https://example.com/${'a'.repeat(2_000)}`,
      },
    });
    expect(sent).toHaveLength(2);
    for (const body of sent)
      expect(body.length).toBeLessThanOrEqual(GITHUB_ISSUE_BODY_MAX);
  });
});

describe('GitHub error snippet', () => {
  test('keeps the first 300 characters of a large multi-byte error body', async () => {
    const body = '✓'.repeat(5000);
    globalThis.fetch = mock(
      async () => new Response(body, { status: 422 }),
    ) as unknown as typeof fetch;

    const error = await createUserReportedIssue({
      ...auth,
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
