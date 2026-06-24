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
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  test('does not report React Router 404 route errors', async () => {
    const fetchMock = mock(async () => {
      return Response.json({ ok: true });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await errorTelemetry.reportErrorTelemetry(
      {
        status: 404,
        statusText: 'Not Found',
        internal: true,
        data: 'No route matches URL "/assets/app-abc123.js"',
      },
      {
        timestamp: '2026-04-27T12:00:00.000Z',
        url: 'https://example.com/assets/app-abc123.js',
      },
    );

    expect(fetchMock).not.toHaveBeenCalled();
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

  test('normalizes volatile asset hashes and stack coordinates in fingerprints', () => {
    const first = errorTelemetry.buildTelemetryFingerprint({
      timestamp: '2026-04-27T12:00:00.000Z',
      url: 'https://example.com/assets/app-C7NZDCaW.js:12:34',
      message: 'Chunk failed',
      stackTrace:
        'TypeError: Chunk failed\n    at https://example.com/assets/app-C7NZDCaW.js:12:34',
    });
    const second = errorTelemetry.buildTelemetryFingerprint({
      timestamp: '2026-04-27T12:01:00.000Z',
      url: 'https://example.com/assets/app-d9xQp2Rz.js:98:76',
      message: 'Chunk failed',
      stackTrace:
        'TypeError: Chunk failed\n    at https://example.com/assets/app-d9xQp2Rz.js:98:76',
    });

    expect(first).toBe(second);
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
