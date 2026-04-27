import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

const originalFetch = globalThis.fetch;
let errorTelemetry: typeof import('./errorTelemetry');

afterEach(() => {
  mock.restore();
  globalThis.fetch = originalFetch;
});

beforeEach(async () => {
  mock.module('../lib/environment', () => ({
    VITE_HONO_BACKEND_URL: 'https://backend.example.com',
  }));

  errorTelemetry = await import('./errorTelemetry');
});

describe('error telemetry', () => {
  test('creates telemetry with timestamp, url, message, and stack trace', () => {
    const error = new Error('Route exploded');
    error.stack = 'stack line';

    expect(
      errorTelemetry.createErrorTelemetry(error, {
        timestamp: '2026-04-27T12:00:00.000Z',
        url: 'https://example.com/summary',
      }),
    ).toEqual({
      timestamp: '2026-04-27T12:00:00.000Z',
      url: 'https://example.com/summary',
      message: 'Route exploded',
      stackTrace: 'stack line',
    });
  });

  test('returns the friendly modal copy unchanged', () => {
    expect(errorTelemetry.ERROR_MODAL_MESSAGE).toContain(
      'Report an issue button in the footer',
    );
  });

  test('falls back to a generic message for unknown errors', () => {
    expect(errorTelemetry.getErrorMessage({})).toBe(
      'Unknown application error',
    );
  });

  test('swallows reporting failures', async () => {
    globalThis.fetch = mock(async () => {
      throw new Error('network down');
    }) as typeof fetch;

    await expect(
      errorTelemetry.reportErrorTelemetry(new Error('ignore me'), {
        timestamp: '2026-04-27T12:00:00.000Z',
        url: 'https://example.com/info',
      }),
    ).resolves.toBeUndefined();
  });

  test('builds a stable fingerprint without timestamp noise', () => {
    expect(
      errorTelemetry.buildTelemetryFingerprint({
        timestamp: '2026-04-27T12:00:00.000Z',
        url: 'https://example.com/info',
        message: 'Route exploded',
        stackTrace: 'stack line',
      }),
    ).toBe(
      JSON.stringify({
        url: 'https://example.com/info',
        message: 'Route exploded',
        stackTrace: 'stack line',
      }),
    );
  });

  test('suppresses duplicate telemetry within the strict-mode dedupe window', () => {
    errorTelemetry.resetReportedTelemetryForTests();

    const telemetry = {
      timestamp: '2026-04-27T12:00:00.000Z',
      url: 'https://example.com/info',
      message: 'Route exploded',
      stackTrace: 'stack line',
    };

    expect(
      errorTelemetry.shouldSkipDuplicateTelemetryReport(telemetry, 1_000),
    ).toBe(false);
    expect(
      errorTelemetry.shouldSkipDuplicateTelemetryReport(telemetry, 1_100),
    ).toBe(true);
    expect(
      errorTelemetry.shouldSkipDuplicateTelemetryReport(telemetry, 2_500),
    ).toBe(false);
  });
});
