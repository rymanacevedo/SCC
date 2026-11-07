import { afterEach, describe, expect, mock, test } from 'bun:test';
import { TRUNCATED } from '../../shared/telemetryRedaction.ts';
import {
  expectNoSensitiveValues,
  SENSITIVE_DESCRIPTION,
  SENSITIVE_MESSAGE,
  SENSITIVE_STACK,
  SENSITIVE_URL,
} from '../../test/sensitive-telemetry.ts';
import {
  buildAutoReportedIssueBody,
  buildUserReportedIssueBody,
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

describe('issue bodies', () => {
  const telemetry = {
    timestamp: '2026-04-27T12:00:00.000Z',
    url: SENSITIVE_URL,
    message: SENSITIVE_MESSAGE,
    stackTrace: SENSITIVE_STACK,
  };

  test('the auto-reported body is path-only and redacted, with readable frames', () => {
    const body = buildAutoReportedIssueBody(telemetry);
    expectNoSensitiveValues(body);
    expect(body).toContain('- URL: https://scc.example/summary\n');
    expect(body).toContain('- Message: Save failed for [redacted]');
    expect(body).toContain(
      'at saveSummary (https://scc.example/assets/main-abcdef12.js:12:34)',
    );
    expect(body).toContain('at fetchWithAuth (');
  });

  test('the user-reported body is path-only and redacted', () => {
    const body = buildUserReportedIssueBody({
      timestamp: '2026-04-27T12:00:00.000Z',
      url: SENSITIVE_URL,
      description: SENSITIVE_DESCRIPTION,
    });
    expectNoSensitiveValues(body);
    expect(body).toContain('- URL: https://scc.example/summary\n');
    expect(body).toContain('then it broke.');
  });

  test('over-long fields are truncated with a marker', () => {
    const auto = buildAutoReportedIssueBody({
      ...telemetry,
      message: 'm'.repeat(50_000),
      stackTrace: 's'.repeat(50_000),
    });
    const user = buildUserReportedIssueBody({
      timestamp: '2026-04-27T12:00:00.000Z',
      url: `https://scc.example/${'p'.repeat(50_000)}`,
      description: 'd'.repeat(50_000),
    });
    for (const body of [auto, user]) {
      expect(body).toContain(TRUNCATED);
      expect(body.length).toBeLessThan(65_536);
    }
    expect(auto).not.toContain('m'.repeat(1_001));
    expect(user).not.toContain('d'.repeat(8_001));
  });

  test('queries that differ only by query string share one fingerprint', () => {
    const fingerprint = (url: string) =>
      buildAutoReportedIssueBody({ ...telemetry, url }).split('\n')[2];
    expect(fingerprint('https://scc.example/summary?token=one')).toBe(
      fingerprint('https://scc.example/summary?token=two#other'),
    );
  });

  test('the auto-reported issue title uses the redacted message', async () => {
    const fetchMock = mock(async (input: RequestInfo | URL) =>
      String(input).includes('/issues?')
        ? Response.json([])
        : Response.json({ id: 1 }, { status: 201 }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await createAutoReportedIssue({
      repo: 'acme/scc',
      token: 'token-123',
      payload: telemetry,
    });
    const post = fetchMock.mock.calls.find(
      ([input]) => !String(input).includes('?'),
    ) as unknown as [string, RequestInit];
    expectNoSensitiveValues(String(post[1].body));
    expect(JSON.parse(String(post[1].body)).title).toBe(
      'Auto-reported error: Save failed for [redacted], call [redacted]',
    );
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
