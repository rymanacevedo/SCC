import { afterEach, expect, test } from 'bun:test';
import {
  buildTelemetryFingerprint,
  resetReportedTelemetryForTests,
  sanitizeErrorTelemetry,
  sanitizeUserIssueReport,
  shouldSkipDuplicateTelemetryReport,
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
test('sanitizes every Error telemetry and User report field', () => {
  expect<unknown>(
    sanitizeErrorTelemetry({
      timestamp: telemetry.timestamp,
      url: 'https://scc.example/info?token=abc123#fragment',
      message: `Call 555-123-4567 ${'m'.repeat(2_000)}`,
      stackTrace:
        'Error\n    at save (https://scc.example/a.js:1:2) apiKey=s3cr3t',
    }),
  ).toEqual({
    timestamp: telemetry.timestamp,
    url: 'https://scc.example/info',
    message: expect.stringMatching(/^Call \[redacted\] m+… \[truncated\]$/),
    stackTrace:
      'Error\n    at save (https://scc.example/a.js:1:2) apiKey=[redacted]',
  });
  expect(
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
  expect(shouldSkipDuplicateTelemetryReport(telemetry, 100)).toBe(false);
  expect(shouldSkipDuplicateTelemetryReport(telemetry, 1_100)).toBe(true);
  expect(shouldSkipDuplicateTelemetryReport(telemetry, 1_101)).toBe(false);
  resetReportedTelemetryForTests();
  expect(shouldSkipDuplicateTelemetryReport(telemetry, 1_102)).toBe(false);
});
