import { afterEach, expect, test } from 'bun:test';
import {
  boundTelemetry,
  buildTelemetryFingerprint,
  errorTelemetrySchema,
  resetReportedTelemetryForTests,
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
test('dedupes through one second, expires afterwards, and reset permits reporting again', () => {
  expect(shouldSkipDuplicateTelemetryReport(telemetry, 100)).toBe(false);
  expect(shouldSkipDuplicateTelemetryReport(telemetry, 1_100)).toBe(true);
  expect(shouldSkipDuplicateTelemetryReport(telemetry, 1_101)).toBe(false);
  resetReportedTelemetryForTests();
  expect(shouldSkipDuplicateTelemetryReport(telemetry, 1_102)).toBe(false);
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

test('boundTelemetry truncates oversized fields so the report stays valid', () => {
  const bounded = boundTelemetry({
    timestamp: telemetry.timestamp,
    url: longUrl(5_000),
    message: 'm'.repeat(5_000),
    stackTrace: 's'.repeat(50_000),
  });
  expect(bounded.url).toBe(longUrl(2_048));
  expect(bounded.message).toBe('m'.repeat(1_000));
  expect(bounded.stackTrace).toBe('s'.repeat(16_000));
  expect(errorTelemetrySchema.safeParse(bounded).success).toBe(true);
  expect(boundTelemetry(telemetry)).toEqual(telemetry);
  const { stackTrace: _, ...withoutStack } = telemetry;
  expect(boundTelemetry(withoutStack)).toEqual(withoutStack);
});
