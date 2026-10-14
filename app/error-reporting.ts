import { shouldSkipDuplicateTelemetryReport } from '../shared/errorReporting.ts';
import type { Result } from '../shared/result.ts';
import { reportError } from './api.ts';

export const ERROR_MODAL_MESSAGE =
  'An error has occurred. Please click the Report an issue button in the footer to report this error.';

export function isNotFoundResponse(error: unknown): boolean {
  return error instanceof Response && error.status === 404;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || 'Unknown application error';
  }
  if (error instanceof Response) {
    return `${error.status} ${error.statusText}`.trim();
  }
  if (typeof error === 'string' && error) {
    return error;
  }
  return 'Unknown application error';
}

export async function reportErrorTelemetry(
  error: unknown,
  url = globalThis.location?.href ?? 'unknown',
): Promise<Result<{ ok: true }>> {
  try {
    if (isNotFoundResponse(error)) return { ok: true, value: { ok: true } };
    // Explicit allowlist: never serialize the thrown object or the User.
    const telemetry = {
      url,
      timestamp: new Date().toISOString(),
      message: errorMessage(error),
      ...(error instanceof Error && error.stack
        ? { stackTrace: error.stack }
        : {}),
    };
    if (shouldSkipDuplicateTelemetryReport(telemetry))
      return { ok: true, value: { ok: true } };
    return await reportError(telemetry);
  } catch {
    return { ok: false, error: 'network' };
  }
}
