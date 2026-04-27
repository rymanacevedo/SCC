import { isRouteErrorResponse } from 'react-router';
import {
  type ErrorTelemetryPayload as ErrorTelemetry,
  errorTelemetrySchema,
} from '../../../shared/errorReporting';
import { VITE_HONO_BACKEND_URL } from '../lib/environment';

export const ERROR_MODAL_MESSAGE =
  'An error has occurred. Please click the Report an issue button in the footer to report this error.';

export type { ErrorTelemetry };
export { errorTelemetrySchema };

type ErrorInput = unknown;
const RECENT_REPORT_WINDOW_MS = 1_000;
const recentlyReportedErrors = new Map<string, number>();

export function buildTelemetryFingerprint(telemetry: ErrorTelemetry): string {
  return JSON.stringify({
    url: telemetry.url,
    message: telemetry.message,
    stackTrace: telemetry.stackTrace ?? '',
  });
}

export function shouldSkipDuplicateTelemetryReport(
  telemetry: ErrorTelemetry,
  now = Date.now(),
): boolean {
  for (const [fingerprint, timestamp] of recentlyReportedErrors.entries()) {
    if (now - timestamp > RECENT_REPORT_WINDOW_MS) {
      recentlyReportedErrors.delete(fingerprint);
    }
  }

  const fingerprint = buildTelemetryFingerprint(telemetry);
  const previousTimestamp = recentlyReportedErrors.get(fingerprint);

  if (
    previousTimestamp !== undefined &&
    now - previousTimestamp <= RECENT_REPORT_WINDOW_MS
  ) {
    return true;
  }

  recentlyReportedErrors.set(fingerprint, now);
  return false;
}

export function resetReportedTelemetryForTests() {
  recentlyReportedErrors.clear();
}

export function getErrorMessage(error: ErrorInput): string {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText}`.trim();
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown application error';
}

export function getErrorStackTrace(error: ErrorInput): string | undefined {
  if (isRouteErrorResponse(error)) {
    return error.data ? JSON.stringify(error.data, null, 2) : undefined;
  }

  if (error instanceof Error) {
    return error.stack;
  }

  return undefined;
}

export function createErrorTelemetry(
  error: ErrorInput,
  options: { timestamp?: string; url?: string } = {},
): ErrorTelemetry {
  return {
    timestamp: options.timestamp ?? new Date().toISOString(),
    url: options.url ?? globalThis.location?.href ?? 'unknown',
    message: getErrorMessage(error),
    stackTrace: getErrorStackTrace(error),
  };
}

export async function reportErrorTelemetry(
  error: ErrorInput,
  options: { timestamp?: string; url?: string } = {},
) {
  try {
    const telemetry = createErrorTelemetry(error, options);
    if (shouldSkipDuplicateTelemetryReport(telemetry)) {
      return;
    }

    await fetch(`${VITE_HONO_BACKEND_URL}/api/errors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(telemetry),
    });
  } catch {
    // Reporting failures should never create a second user-facing failure.
  }
}
