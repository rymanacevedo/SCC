import { afterEach, describe, expect, mock, test } from 'bun:test';
import { createAutoReportedIssue } from './github';

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
