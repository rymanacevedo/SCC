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
  stackTrace: 'at https://scc.example/assets/main-abcdef12.js:12:34',
};
afterEach(resetReportedTelemetryForTests);
const buildTelemetryFingerprint = (payload: ErrorTelemetryPayload) =>
  buildSanitizedTelemetryFingerprint(sanitizeErrorTelemetry(payload));
test('fingerprint ignores timestamps, asset hashes and stack coordinates', () => {
  expect(buildTelemetryFingerprint(telemetry)).toBe(
    buildTelemetryFingerprint({
      ...telemetry,
      timestamp: '2026-10-14T00:00:01.000Z',
      stackTrace: 'at https://scc.example/assets/main-ghijkl34.js:56:78',
    }),
  );
  expect(
    buildTelemetryFingerprint({ ...telemetry, message: 'Different' }),
  ).not.toBe(buildTelemetryFingerprint(telemetry));
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
  const base = { url: 'https://scc.example/x', message: 'm', description: 'd' };
  expect(
    sanitizeErrorTelemetry({ ...base, timestamp: oversized }).timestamp,
  ).toBe('2026-10-13T00:00:00.111Z');
  expect(
    sanitizeUserIssueReport({ ...base, timestamp: oversized }).timestamp,
  ).toBe('2026-10-13T00:00:00.111Z');
  expect(sanitizeReportTimestamp('2026-10-13T05:00:00+05:00')).toBe(
    '2026-10-13T00:00:00.000Z',
  );
  expect(sanitizeReportTimestamp(`x${'9'.repeat(70_000)}`)).toBe('[redacted]');
});
test('sanitizes every Error telemetry and User report field', () => {
  expect<unknown>(
    sanitizeErrorTelemetry({
      timestamp: telemetry.timestamp,
      url: 'https://scc.example/info?token=abc123#fragment',
      message: `Call 555-123-4567 ${'word '.repeat(400)}`,
      stackTrace:
        'Error\n    at save (https://scc.example/a.js:1:2) apiKey=s3cr3t',
    }),
  ).toEqual({
    timestamp: telemetry.timestamp,
    url: 'https://scc.example/info',
    message: expect.stringMatching(
      /^Call \[redacted\] [word ]+… \[truncated\]$/,
    ),
    stackTrace: 'Error\n    [frame omitted]',
  });
  expect<unknown>(
    sanitizeUserIssueReport({
      timestamp: telemetry.timestamp,
      url: 'https://scc.example/info#fragment',
      description: 'Email me at jane@example.com',
    }),
  ).toEqual({
    timestamp: telemetry.timestamp,
    url: 'https://scc.example/info',
    description: 'Email me at [redacted]',
  });
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
  description: 'The page failed',
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
  const caps = { url: longUrl(2_048), description: 'd'.repeat(10_000) };
  expect(userIssueReportSchema.safeParse({ ...report, ...caps }).success).toBe(
    true,
  );
  expect(
    userIssueReportSchema.safeParse({ ...report, ...caps, url: `${caps.url}x` })
      .success,
  ).toBe(false);
  expect(
    userIssueReportSchema.safeParse({
      ...report,
      description: `${caps.description}x`,
    }).success,
  ).toBe(false);
});

test('sanitizing cuts oversized fields so both reports stay valid, marker included', () => {
  const frame = '    at frame (https://scc.example/assets/a.js:1:2)';
  const telemetry = sanitizeErrorTelemetry({
    timestamp: '2026-10-14T00:00:00.000Z',
    url: longUrl(5_000),
    message: 'word '.repeat(1_500),
    stackTrace: `Error: Broken\n${`${frame}\n`.repeat(1_000)}`,
  });
  expect(telemetry.message.length).toBeLessThanOrEqual(
    REPORT_FIELD_LIMITS.message,
  );
  expect(telemetry.message.endsWith('… [truncated]')).toBe(true);
  expect(telemetry.stackTrace?.length).toBeLessThanOrEqual(
    REPORT_FIELD_LIMITS.stackTrace,
  );
  expect(telemetry.stackTrace?.endsWith('… [truncated]')).toBe(true);
  expect(errorTelemetrySchema.safeParse(telemetry).success).toBe(true);
  const report = sanitizeUserIssueReport({
    timestamp: '2026-10-14T00:00:00.000Z',
    url: 'https://scc.example/info',
    description: 'word '.repeat(3_000),
  });
  expect(report.description.length).toBeLessThanOrEqual(
    REPORT_FIELD_LIMITS.description,
  );
  expect(userIssueReportSchema.safeParse(report).success).toBe(true);
});
