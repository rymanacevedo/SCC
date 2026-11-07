import { afterEach, describe, expect, jest, mock, test } from 'bun:test';
import {
  buildSanitizedTelemetryFingerprint,
  type ErrorTelemetryPayload,
  REPORT_FIELD_LIMITS,
  sanitizeErrorTelemetry,
  sanitizeUserIssueReport,
  type UserIssueReportPayload,
  userIssueReportSchema,
} from '../../shared/errorReporting.ts';
import { TRUNCATED } from '../../shared/telemetryRedaction.ts';
import {
  expectNoSensitiveValues,
  SENSITIVE_AT_HEADER_STACK,
  SENSITIVE_DESCRIPTION,
  SENSITIVE_KEY_URL,
  SENSITIVE_MESSAGE,
  SENSITIVE_NAMED_STACK,
  SENSITIVE_STACK,
  SENSITIVE_TIMESTAMP,
  SENSITIVE_URL,
} from '../../test/sensitive-reports.ts';
import {
  buildAutoReportedIssueBody,
  buildUserReportedIssueBody,
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
const filedBody = async (payload: ErrorTelemetryPayload) => {
  const telemetry = sanitizeErrorTelemetry(payload);
  return buildAutoReportedIssueBody(
    telemetry,
    await issueFingerprint(telemetry),
  );
};
/** The user-reported body GitHub holds for `payload`. */
const filedUserBody = (payload: UserIssueReportPayload) =>
  buildUserReportedIssueBody(sanitizeUserIssueReport(payload));
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
/** Records each issue GitHub is asked to create; the open-issue list is empty. */
function captureCreatedIssues() {
  const sent: { title: string; body: string }[] = [];
  globalThis.fetch = mock(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/issues?')) return Response.json([]);
      sent.push(JSON.parse(String(init?.body)));
      return Response.json({ id: 2 }, { status: 201 });
    },
  ) as unknown as typeof fetch;
  return sent;
}

const chunkFailure = {
  timestamp: '2026-04-27T12:00:00.000Z',
  url: 'https://example.com/assets/app-a1b2c3d4.js',
  message: 'Chunk failed',
  stackTrace:
    'TypeError: Chunk failed\n    at https://example.com/assets/app-a1b2c3d4.js:12:34',
};
// The same failure from another build: a new asset hash and stack coordinates.
const chunkFailureNextBuild = {
  ...chunkFailure,
  timestamp: '2026-04-28T09:00:00.000Z',
  url: 'https://example.com/assets/app-ffee9988.js',
  stackTrace:
    'TypeError: Chunk failed\n    at https://example.com/assets/app-ffee9988.js:1:2',
};

describe('issueFingerprint', () => {
  test('is the SHA-256 hex digest of the sanitized telemetry fingerprint', async () => {
    // The digest of {"name":"","url":"https://app.invalid/","frames":[]}.
    expect(
      await issueFingerprint(
        sanitizeErrorTelemetry({
          timestamp: '2026-04-27T12:00:00.000Z',
          url: 'https://example.com/',
          message: 'Broken',
        }),
      ),
    ).toBe('1fd1c3386d5b693285f573e2d94316876eeaefc00aaf3776cd2efd390efa0474');
  });

  test('queries, fragments and messages do not split it', async () => {
    const fingerprint = (url: string, message: string) =>
      issueFingerprint(
        sanitizeErrorTelemetry({ ...chunkFailure, url, message }),
      );
    expect(
      await fingerprint(
        'https://scc.example/summary?token=one',
        'Save failed for jane@example.com',
      ),
    ).toBe(
      await fingerprint(
        'https://app.invalid/summary?token=two#other',
        'Save failed for sam@example.org',
      ),
    );
  });
});

describe('GitHub issue body rendering', () => {
  test('a user-reported issue body is the page and the time', () => {
    expect(
      filedUserBody({
        timestamp: '2026-04-27T12:00:00.000Z',
        url: 'https://example.com/builder?x=1',
      }),
    ).toBe(
      [
        '# User-reported issue',
        '',
        '- Timestamp: 2026-04-27T12:00:00.000Z',
        '- URL: `https://app.invalid/builder`',
      ].join('\n'),
    );
  });

  test('a stack trace keeps only its error name and frames; the message is its length', async () => {
    const body = await filedBody({
      timestamp: '2026-04-27T12:00:00.000Z',
      url: 'https://example.com/\n# Injected',
      message: 'Boom ``x``\n## Close this issue',
      stackTrace: 'TypeError: Boom ``` close\n```\n- [ ] close this issue',
    });

    expect(body.split('\n').slice(3)).toEqual([
      '- Timestamp: 2026-04-27T12:00:00.000Z',
      '- URL: `https://app.invalid/`',
      '- Message: `[message omitted: 30 characters]`',
      '',
      '## Stack trace',
      '```',
      'TypeError',
      '    [frame omitted]',
      '```',
    ]);
  });

  test('an ordinary auto-reported error reads as plain text in three-backtick fences', () => {
    const body = buildAutoReportedIssueBody(
      sanitizeErrorTelemetry({
        timestamp: '2026-04-27T12:00:00.000Z',
        url: 'https://example.com/',
        message: 'Chunk failed',
      }),
      'abc123',
    );

    expect(body).toBe(
      [
        '# Auto-reported application error',
        '',
        '- Fingerprint: abc123',
        '- Timestamp: 2026-04-27T12:00:00.000Z',
        '- URL: `https://app.invalid/`',
        '- Message: `[message omitted: 12 characters]`',
        '',
        '## Stack trace',
        '```',
        'No stack trace available.',
        '```',
      ].join('\n'),
    );
  });
});

describe('issue bodies sent to GitHub', () => {
  const telemetry = {
    timestamp: SENSITIVE_TIMESTAMP,
    url: SENSITIVE_URL,
    message: SENSITIVE_MESSAGE,
    stackTrace: SENSITIVE_STACK,
  };

  test('the auto-reported title and body carry structure only', async () => {
    const sent = captureCreatedIssues();
    await createAutoReportedIssue({ ...auth, payload: telemetry });
    expect(sent).toHaveLength(1);
    const { title, body } = sent[0] ?? { title: '', body: '' };
    expectNoSensitiveValues(`${title}\n${body}`);
    expect(title).toBe('Auto-reported error: TypeError at /summary');
    expect(body).toContain('- Timestamp: 2026-10-13T00:00:00.111Z\n');
    expect(body).toContain('- URL: `https://app.invalid/summary`\n');
    expect(body).toContain(
      `- Message: \`[message omitted: ${SENSITIVE_MESSAGE.length} characters]\`\n`,
    );
    expect(body).toContain(
      [
        '```',
        'TypeError',
        '    at saveSummary (https://app.invalid/assets/main-abcdef12.js:12:34)',
        '    [frame omitted]',
        '    at retry (https://app.invalid/assets/api-1a2b3c4d.js:9:9)',
        '    at loadPage (https://app.invalid/assets/page.js:3:4)',
        '    [frame omitted]',
        '    at fn (https://app.invalid/a(b).js:7:8)',
        '    at dial (https://app.invalid/call/[redacted]/a.js:9:9)',
        '    at <anonymous> (https://app.invalid/reset/[redacted]/a.js:1:2)',
        '    at keyed (https://app.invalid/k/[redacted]/a.js:1:2)',
        '    at <anonymous> (https://app.invalid/k/[redacted]/a.js:1:2)',
        '    at <anonymous> (https://app.invalid/k/[redacted]/a.js:3:4)',
        '    at <anonymous> (https://app.invalid/k/[redacted]:5:6)',
        '    at <anonymous> (https://app.invalid/a.js:2:2)',
        '    at <anonymous> (https://app.invalid/a.js:2:3)',
        '    [frame omitted]',
        '    at load (blob:https://app.invalid/token.js:2:5)',
        '    at <anonymous> (https://app.invalid/a.js:3:1)',
        '    at <anonymous> (https://app.invalid/a.js:3:2)',
        '    at eval (https://app.invalid/script.js:3:3)',
        '    [frame omitted]',
        '```',
      ].join('\n'),
    );
  });

  test("an older client's description never reaches GitHub", async () => {
    const sent = captureCreatedIssues();
    await createUserReportedIssue({
      ...auth,
      payload: userIssueReportSchema.parse({
        timestamp: '2026-10-13T00:00:00.000Z',
        url: SENSITIVE_URL,
        description: SENSITIVE_DESCRIPTION,
      }),
    });
    const body = sent[0]?.body ?? '';
    expectNoSensitiveValues(body);
    expect(body).not.toContain('Description');
    expect(body).toBe(
      [
        '# User-reported issue',
        '',
        '- Timestamp: 2026-10-13T00:00:00.000Z',
        '- URL: `https://app.invalid/summary`',
      ].join('\n'),
    );
  });

  test('the stack header keeps only a known error class name', async () => {
    const sent = captureCreatedIssues();
    const stackTrace =
      'apiKey: headersecretvalue\n    at f (https://scc.example/a.js:1:2)';
    await createAutoReportedIssue({
      ...auth,
      payload: { ...chunkFailure, stackTrace },
    });
    expectNoSensitiveValues(`${sent[0]?.title}\n${sent[0]?.body}`);
    expect(sent[0]?.title).toBe(
      'Auto-reported error: Error at /assets/app-a1b2c3d4.js',
    );
    expect(sent[0]?.body).toContain('\nError\n    at f (');
  });

  test('through both sanitizing passes, nothing sensitive reaches title, body or fingerprint', async () => {
    const sent = captureCreatedIssues();
    // The browser sanitizes first; the Worker sanitizes what it receives.
    const fromBrowser = sanitizeErrorTelemetry(telemetry);
    expect(sanitizeErrorTelemetry(fromBrowser)).toEqual(fromBrowser);
    await createAutoReportedIssue({ ...auth, payload: fromBrowser });
    const { title, body } = sent[0] ?? { title: '', body: '' };
    expectNoSensitiveValues(`${title}\n${body}`);
    expectNoSensitiveValues(buildSanitizedTelemetryFingerprint(fromBrowser));
    expect(title).toBe('Auto-reported error: TypeError at /summary');
  });

  test('a key-bearing error name reaches neither title, body nor fingerprint', async () => {
    const sent = captureCreatedIssues();
    const payload = { ...chunkFailure, stackTrace: SENSITIVE_NAMED_STACK };
    await createAutoReportedIssue({ ...auth, payload });
    expectNoSensitiveValues(`${sent[0]?.title}\n${sent[0]?.body}`);
    expect(sent[0]?.title).toBe(
      'Auto-reported error: Error at /assets/app-a1b2c3d4.js',
    );
    const fingerprint = buildSanitizedTelemetryFingerprint(
      sanitizeErrorTelemetry(payload),
    );
    expectNoSensitiveValues(fingerprint);
    expect(JSON.parse(fingerprint).name).toBe('Error');
  });

  test('a key in the page URL or a header ending like a frame reaches no issue', async () => {
    const sent = captureCreatedIssues();
    await createAutoReportedIssue({
      ...auth,
      payload: {
        ...chunkFailure,
        url: SENSITIVE_KEY_URL,
        stackTrace: SENSITIVE_AT_HEADER_STACK,
      },
    });
    await createUserReportedIssue({
      ...auth,
      payload: { timestamp: chunkFailure.timestamp, url: SENSITIVE_KEY_URL },
    });
    for (const { title, body } of sent) {
      expectNoSensitiveValues(`${title}\n${body}`);
      expect(body).toContain(
        '- URL: `https://app.invalid/k/[redacted]/[redacted]/[redacted]`',
      );
    }
    expect(sent[0]?.title).toBe(
      'Auto-reported error: Error at /k/[redacted]/[redacted]/[redacted]',
    );
    expect(sent[0]?.body).toContain(
      '\nError\n    at save (https://app.invalid/a.js:1:2)\n',
    );
  });

  test('a formatted phone number in a report URL path reaches neither body nor fingerprint', async () => {
    const sent = captureCreatedIssues();
    const url = 'https://scc.example/call/555-987-6543';
    await createAutoReportedIssue({
      ...auth,
      payload: { ...chunkFailure, url },
    });
    await createUserReportedIssue({
      ...auth,
      payload: {
        timestamp: chunkFailure.timestamp,
        url,
      },
    });
    for (const { title, body } of sent) {
      expectNoSensitiveValues(`${title}\n${body}`);
      expect(body).toContain('- URL: `https://app.invalid/call/[redacted]`');
    }
    expect(
      buildSanitizedTelemetryFingerprint(
        sanitizeErrorTelemetry({ ...chunkFailure, url }),
      ),
    ).not.toContain('555');
  });

  test('a dev URL with an IP host reaches GitHub with the placeholder origin', async () => {
    const sent = captureCreatedIssues();
    await createUserReportedIssue({
      ...auth,
      payload: {
        timestamp: chunkFailure.timestamp,
        url: 'http://127.0.0.1:5173/info',
      },
    });
    expect(sent[0]?.body).toEndWith('\n- URL: `https://app.invalid/info`');
  });

  test('an over-long stack is cut at a frame boundary with a marker', async () => {
    const sent = captureCreatedIssues();
    const frame = '    at frame (https://scc.example/a.js:1:2)';
    await createAutoReportedIssue({
      ...auth,
      payload: {
        ...telemetry,
        message: 'word '.repeat(10_000),
        stackTrace: `Error: Broken\n${`${frame}\n`.repeat(5_000)}`,
      },
    });
    const body = sent[0]?.body ?? '';
    expect(body).toContain(
      `${frame.replace('https://scc.example', 'https://app.invalid')}\n${TRUNCATED}\n`,
    );
    expect(body).toContain('- Message: `[message omitted: 50000 characters]`');
    expect(body.length).toBeLessThan(GITHUB_ISSUE_BODY_MAX);
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

  test('an issue filed under an earlier fingerprint gets one new issue, and no raw text is sent', async () => {
    const unsanitized = JSON.stringify({
      url: SENSITIVE_URL,
      message: SENSITIVE_MESSAGE,
      stackTrace: '',
    });
    const fetchMock = githubWith([
      { number: 5, body: `- Fingerprint: ${unsanitized}` },
    ]);
    const payload = {
      ...chunkFailure,
      url: SENSITIVE_URL,
      message: SENSITIVE_MESSAGE,
    };

    expect(await createAutoReportedIssue({ ...auth, payload })).toEqual({
      id: 2,
    });
    for (const [input, init] of fetchMock.mock.calls as unknown as [
      string,
      RequestInit | undefined,
    ][])
      expectNoSensitiveValues(`${input}\n${String(init?.body ?? '')}`);
  });

  test('reports that differ only below the top five frames are deduped together', async () => {
    const frames =
      '    at frame (https://example.com/assets/a.js:1:2)\n'.repeat(5);
    const first = {
      ...chunkFailure,
      stackTrace: `TypeError: x\n${frames}    at first (x.js:1:2)`,
    };
    const second = {
      ...chunkFailure,
      stackTrace: `TypeError: y\n${frames}    at second (x.js:1:2)`,
    };
    expect(await issueFingerprint(sanitizeErrorTelemetry(first))).toBe(
      await issueFingerprint(sanitizeErrorTelemetry(second)),
    );
    const fetchMock = githubWith([{ number: 9, body: await filedBody(first) }]);
    expect(await createAutoReportedIssue({ ...auth, payload: second })).toEqual(
      { deduped: true, issueNumber: 9 },
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('reports that differ in a top frame are not deduped together', async () => {
    const first = {
      ...chunkFailure,
      stackTrace: 'TypeError: x\n    at first (https://example.com/a.js:1:2)',
    };
    const second = {
      ...chunkFailure,
      stackTrace: 'TypeError: x\n    at second (https://example.com/a.js:1:2)',
    };
    const fetchMock = githubWith([{ number: 9, body: await filedBody(first) }]);
    expect(await createAutoReportedIssue({ ...auth, payload: second })).toEqual(
      { id: 2 },
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('GitHub issue body size', () => {
  // U+0001 passes every field limit yet JSON-escapes to six characters. It is
  // not a safe shape, so sanitizing reduces it to [redacted].
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
    expect(body).not.toContain('\u0001');

    githubWith([{ number: 7, body }]);
    expect(
      await createAutoReportedIssue({ ...auth, payload: worstCase }),
    ).toEqual({ deduped: true, issueNumber: 7 });
  });

  test('every issue body sent to GitHub stays under its limit', async () => {
    const sent = captureCreatedIssues();
    await createAutoReportedIssue({ ...auth, payload: worstCase });
    await createUserReportedIssue({
      ...auth,
      payload: {
        timestamp: worstCase.timestamp,
        url: `https://example.com/${'a'.repeat(2_000)}`,
      },
    });
    expect(sent).toHaveLength(2);
    for (const { body } of sent)
      expect(body.length).toBeLessThanOrEqual(GITHUB_ISSUE_BODY_MAX);
  });

  test('fields of backticks at their limits reach GitHub only as placeholders', async () => {
    const backticks = (count: number) => '`'.repeat(count);
    const sent = captureCreatedIssues();
    await createAutoReportedIssue({
      ...auth,
      payload: {
        timestamp: worstCase.timestamp,
        url: 'https://example.com/',
        message: backticks(REPORT_FIELD_LIMITS.message),
        stackTrace: backticks(REPORT_FIELD_LIMITS.stackTrace),
      },
    });
    const body = sent[0]?.body ?? '';
    expect(body).toContain('- Message: `[message omitted: 1000 characters]`');
    expect(body.endsWith('\n```\nError\n```')).toBe(true);
    expect(body).not.toContain('````');
  });

  test('a user report whose URL is not http(s) reaches GitHub with the placeholder origin', async () => {
    const sent = captureCreatedIssues();
    await createUserReportedIssue({
      ...auth,
      payload: {
        timestamp: worstCase.timestamp,
        url: `a:${'`'.repeat(REPORT_FIELD_LIMITS.url - 2)}`,
      },
    });
    expect(sent[0]?.body).toEndWith('\n- URL: `https://app.invalid/`');
  });
});

describe('GitHub error responses', () => {
  test('keep only the status: the error body is free text, never read', async () => {
    let cancelled = false;
    const body = new ReadableStream({
      pull(controller) {
        controller.enqueue(
          new TextEncoder().encode('Bad credentials for jane.doe@example.com'),
        );
      },
      cancel() {
        cancelled = true;
      },
    });
    globalThis.fetch = mock(
      async () => new Response(body, { status: 422 }),
    ) as unknown as typeof fetch;
    const error = await createUserReportedIssue({
      ...auth,
      payload: {
        timestamp: '2026-04-27T12:00:00.000Z',
        url: 'https://example.com/',
      },
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(GitHubIssueCreationError);
    expect(error).toMatchObject({ kind: 'http', status: 422 });
    expectNoSensitiveValues(JSON.stringify(error));
    expect(cancelled).toBe(true);
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
      payload: { ...telemetry },
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
