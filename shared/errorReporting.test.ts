import { afterEach, expect, test } from 'bun:test';
import {
  buildSanitizedTelemetryFingerprint,
  type ErrorTelemetryPayload,
  errorTelemetrySchema,
  REPORT_FIELD_LIMITS,
  resetReportedTelemetryForTests,
  sanitizeErrorTelemetry,
  sanitizeReportTimestamp,
  sanitizeUserIssueReport,
  shouldSkipDuplicateTelemetryReport,
  userIssueReportSchema,
} from './errorReporting.ts';

const telemetry = {
  timestamp: '2026-10-14T00:00:00.000Z',
  url: 'https://scc.example/info',
  message: 'Broken page',
  stackTrace:
    'TypeError: Broken page\n    at render (https://scc.example/assets/main-abcdef12.js:12:34)',
};
afterEach(resetReportedTelemetryForTests);
const buildTelemetryFingerprint = (payload: ErrorTelemetryPayload) =>
  buildSanitizedTelemetryFingerprint(sanitizeErrorTelemetry(payload));
test("fingerprint is the error name, route and top frames' files, normalized across builds", () => {
  expect(buildTelemetryFingerprint(telemetry)).toBe(
    JSON.stringify({
      name: 'TypeError',
      url: 'https://app.invalid/info',
      files: ['https://app.invalid/assets/main-[hash].js'],
    }),
  );
  // Another build, another time, another message: the same error.
  expect(
    buildTelemetryFingerprint({
      ...telemetry,
      timestamp: '2026-10-14T00:00:01.000Z',
      message: 'Broken page for jane@example.com',
      stackTrace:
        'TypeError: other text\n    at render (https://scc.example/assets/main-ghijkl34.js:56:78)',
    }),
  ).toBe(buildTelemetryFingerprint(telemetry));
  // Another name, route or file: another error. A function name is never
  // kept, so it does not split one.
  expect(
    buildTelemetryFingerprint({
      ...telemetry,
      stackTrace: telemetry.stackTrace.replace('render', 'save'),
    }),
  ).toBe(buildTelemetryFingerprint(telemetry));
  for (const other of [
    { stackTrace: telemetry.stackTrace.replace('TypeError', 'RangeError') },
    { url: 'https://scc.example/summary' },
    { stackTrace: telemetry.stackTrace.replace('/main-', '/pdf-') },
  ])
    expect(buildTelemetryFingerprint({ ...telemetry, ...other })).not.toBe(
      buildTelemetryFingerprint(telemetry),
    );
});

test('fingerprint keeps only the top five frames', () => {
  const frames = (top: string, last: string) =>
    `TypeError: x\n    at f (https://scc.example/assets/${top}-abcdef12.js:1:2)\n${'    at f (https://scc.example/assets/a-abcdef12.js:1:2)\n'.repeat(4)}    at g (https://scc.example/assets/${last}-abcdef12.js:1:2)`;
  const fingerprint = (top: string, last: string) =>
    buildTelemetryFingerprint({ ...telemetry, stackTrace: frames(top, last) });
  expect(fingerprint('main', 'pdf')).toBe(fingerprint('main', 'docx'));
  expect(fingerprint('main', 'pdf')).not.toBe(fingerprint('index', 'pdf'));
});
test('fingerprint is not split by query strings, fragments or redacted values', () => {
  expect(
    buildTelemetryFingerprint({
      ...telemetry,
      url: 'https://scc.example/info?token=abc123#fragment',
      message: 'Broken page for jane@example.com',
    }),
  ).toBe(
    buildTelemetryFingerprint({
      ...telemetry,
      url: 'https://scc.example/info?token=zzz999',
      message: 'Broken page for sam@example.org',
    }),
  );
  expect(
    buildTelemetryFingerprint({
      ...telemetry,
      url: 'https://scc.example/info?token=abc123#fragment',
    }),
  ).not.toContain('abc123');
});
test('normalizes an oversized timestamp to a bounded canonical value in both reports', () => {
  const oversized = `2026-10-13T00:00:00.${'1'.repeat(70_000)}Z`;
  const base = { url: 'https://scc.example/x', message: 'm' };
  expect(
    sanitizeErrorTelemetry({ ...base, timestamp: oversized }).timestamp,
  ).toBe('2026-10-13T00:00:00.111Z');
  expect(
    sanitizeUserIssueReport({ ...base, timestamp: oversized }).timestamp,
  ).toBe('2026-10-13T00:00:00.111Z');
  expect(sanitizeReportTimestamp('2026-10-13T05:00:00+05:00')).toBe(
    '2026-10-13T00:00:00.000Z',
  );
  // An unparseable timestamp becomes the epoch, still a valid ISO datetime.
  expect(sanitizeReportTimestamp(`x${'9'.repeat(70_000)}`)).toBe(
    '1970-01-01T00:00:00.000Z',
  );
});
test('sanitizing keeps structure only: free text is reduced to its length', () => {
  expect<unknown>(
    sanitizeErrorTelemetry({
      timestamp: telemetry.timestamp,
      url: 'https://scc.example/info?token=abc123#fragment',
      message: 'Call 555-123-4567',
      stackTrace:
        'Error: Call 555-123-4567\n    at save (https://scc.example/a.js:1:2) apiKey=s3cr3t',
    }),
  ).toEqual({
    timestamp: telemetry.timestamp,
    url: 'https://app.invalid/info',
    message: '[message omitted: 17 characters]',
    stackTrace: 'Error\n    [frame omitted]',
  });
  expect<unknown>(
    sanitizeUserIssueReport({
      timestamp: telemetry.timestamp,
      url: 'https://scc.example/info#fragment',
    }),
  ).toEqual({
    timestamp: telemetry.timestamp,
    url: 'https://app.invalid/info',
  });
});

test('an over-limit URL is the unknown route, well inside its limit', () => {
  const url = `https://scc.example/${'segment/'.repeat(400)}end`;
  const report = sanitizeUserIssueReport({ timestamp: reportTime, url });
  expect(report.url.length).toBeLessThanOrEqual(REPORT_FIELD_LIMITS.url);
  expect(report.url).toBe('https://app.invalid/[unknown-route]');
  expect(userIssueReportSchema.safeParse(report).success).toBe(true);
  expect(
    errorTelemetrySchema.safeParse(
      sanitizeErrorTelemetry({ timestamp: reportTime, url, message: 'x' }),
    ).success,
  ).toBe(true);
});
const reportTime = '2026-10-14T00:00:00.000Z';

test('a sanitized report always passes its schema, whatever its URL and timestamp', () => {
  for (const url of [
    'http://127.0.0.1:5173/info',
    'about:blank',
    'https://555-123-4567.example/x',
  ]) {
    const report = sanitizeUserIssueReport({ timestamp: 'not a time', url });
    expect(userIssueReportSchema.safeParse(report).success).toBe(true);
    expect(
      errorTelemetrySchema.safeParse(
        sanitizeErrorTelemetry({ ...telemetry, url, timestamp: 'not a time' }),
      ).success,
    ).toBe(true);
  }
});
test('dedupes through one second, expires afterwards, and reset permits reporting again', () => {
  expect(
    shouldSkipDuplicateTelemetryReport(sanitizeErrorTelemetry(telemetry), 100),
  ).toBe(false);
  expect(
    shouldSkipDuplicateTelemetryReport(
      sanitizeErrorTelemetry(telemetry),
      1_100,
    ),
  ).toBe(true);
  expect(
    shouldSkipDuplicateTelemetryReport(
      sanitizeErrorTelemetry(telemetry),
      1_101,
    ),
  ).toBe(false);
  resetReportedTelemetryForTests();
  expect(
    shouldSkipDuplicateTelemetryReport(
      sanitizeErrorTelemetry(telemetry),
      1_102,
    ),
  ).toBe(false);
});

const report = {
  timestamp: '2026-10-14T00:00:00.000Z',
  url: 'https://scc.example/info',
};
const longUrl = (length: number) =>
  `https://scc.example/${'a'.repeat(length - 'https://scc.example/'.length)}`;

test('error telemetry fields are accepted at their caps and refused one character over', () => {
  const caps = {
    url: longUrl(2_048),
    message: 'm'.repeat(1_000),
    stackTrace: 's'.repeat(16_000),
  };
  expect(
    errorTelemetrySchema.safeParse({ ...telemetry, ...caps }).success,
  ).toBe(true);
  for (const [field, value] of Object.entries(caps))
    expect(
      errorTelemetrySchema.safeParse({
        ...telemetry,
        ...caps,
        [field]: `${value}x`,
      }).success,
    ).toBe(false);
  expect(
    errorTelemetrySchema.safeParse({
      ...telemetry,
      timestamp: `2026-10-14T00:00:00.${'0'.repeat(100)}Z`,
    }).success,
  ).toBe(false);
});

test('user issue report fields are accepted at their caps and refused one character over', () => {
  const url = longUrl(2_048);
  expect(userIssueReportSchema.safeParse({ ...report, url }).success).toBe(
    true,
  );
  expect(
    userIssueReportSchema.safeParse({ ...report, url: `${url}x` }).success,
  ).toBe(false);
});

test("an older client's description is stripped by the schema, not refused", () => {
  const parsed = userIssueReportSchema.safeParse({
    ...report,
    description: 'Email me at jane.doe@example.com',
  });
  expect(parsed.success).toBe(true);
  expect(parsed.data).toEqual(report);
});

test('sanitizing bounds oversized fields so both reports stay valid', () => {
  const frame = '    at frame (https://scc.example/assets/a.js:1:2)';
  const telemetry = sanitizeErrorTelemetry({
    timestamp: '2026-10-14T00:00:00.000Z',
    url: longUrl(5_000),
    message: 'word '.repeat(1_500),
    stackTrace: `Error: Broken\n${`${frame}\n`.repeat(1_000)}`,
  });
  expect(telemetry.message).toBe('[message omitted: 7500 characters]');
  expect(telemetry.stackTrace?.length).toBeLessThanOrEqual(
    REPORT_FIELD_LIMITS.stackTrace,
  );
  expect(telemetry.stackTrace?.endsWith('… [truncated]')).toBe(true);
  expect(errorTelemetrySchema.safeParse(telemetry).success).toBe(true);
  const report = sanitizeUserIssueReport({
    timestamp: '2026-10-14T00:00:00.000Z',
    url: longUrl(5_000),
  });
  expect(report.url.length).toBeLessThanOrEqual(REPORT_FIELD_LIMITS.url);
  expect(userIssueReportSchema.safeParse(report).success).toBe(true);
});
