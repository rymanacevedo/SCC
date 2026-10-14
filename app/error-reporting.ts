import { shouldSkipDuplicateTelemetryReport } from '../shared/errorReporting.ts';
import type { Result } from '../shared/result.ts';
import { reportError } from './api.ts';

export const ERROR_MODAL_MESSAGE =
  'An error has occurred. Please click the Report an issue button in the footer to report this error.';

export async function reportErrorTelemetry(
  error: unknown,
  url = globalThis.location?.href ?? 'unknown',
): Promise<Result<{ ok: true }>> {
  try {
    if (error instanceof Response && error.status === 404)
      return { ok: true, value: { ok: true } };
    // Explicit allowlist: never serialize the thrown object or the User.
    const telemetry = {
      url,
      timestamp: new Date().toISOString(),
      message:
        error instanceof Error
          ? error.message || 'Unknown application error'
          : error instanceof Response
            ? `${error.status} ${error.statusText}`.trim()
            : typeof error === 'string' && error
              ? error
              : 'Unknown application error',
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
