import { afterEach, describe, expect, mock, test } from 'bun:test';
import {
  buildAutoReportedIssueBody,
  createAutoReportedIssue,
  createUserReportedIssue,
  GitHubIssueCreationError,
} from './github.ts';

const originalFetch = globalThis.fetch;

afterEach(() => {
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

describe('GitHub issue body size', () => {
  // GitHub refuses an issue body over 65,536 characters.
  const GITHUB_ISSUE_BODY_MAX = 65_536;
  // U+0001 passes every field limit yet JSON-escapes to six characters.
  const worstCase = {
    timestamp: '2026-04-27T12:00:00.000Z',
    url: '\u0001'.repeat(2_048),
    message: '\u0001'.repeat(1_000),
    stackTrace: '\u0001'.repeat(16_000),
  };

  test('a worst-case escaped auto-reported issue body stays under the GitHub limit and still dedupes', async () => {
    const body = buildAutoReportedIssueBody(worstCase);
    expect(body.length).toBeLessThanOrEqual(GITHUB_ISSUE_BODY_MAX);
    expect(body).toContain(worstCase.stackTrace);

    const fetchMock = mock(async (input: RequestInfo | URL) =>
      String(input).includes('/issues?')
        ? Response.json([{ number: 7, body }])
        : Response.json({ id: 2 }, { status: 201 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    expect(
      await createAutoReportedIssue({
        repo: 'acme/scc',
        token: 'token-123',
        payload: worstCase,
      }),
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
    const auth = { repo: 'acme/scc', token: 'token-123' };
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
