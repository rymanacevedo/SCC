import { afterEach, expect, test } from 'bun:test';
import {
  buildTelemetryFingerprint,
  resetReportedTelemetryForTests,
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
test('dedupes through one second, expires afterwards, and reset permits reporting again', () => {
  expect(shouldSkipDuplicateTelemetryReport(telemetry, 100)).toBe(false);
  expect(shouldSkipDuplicateTelemetryReport(telemetry, 1_100)).toBe(true);
  expect(shouldSkipDuplicateTelemetryReport(telemetry, 1_101)).toBe(false);
  resetReportedTelemetryForTests();
  expect(shouldSkipDuplicateTelemetryReport(telemetry, 1_102)).toBe(false);
});
