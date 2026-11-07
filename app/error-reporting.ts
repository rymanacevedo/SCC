import {
  sanitizeErrorTelemetry,
  shouldSkipDuplicateTelemetryReport,
} from '../shared/errorReporting.ts';
import type { Result } from '../shared/result.ts';
import { stackWithHeader } from '../shared/stackFrames.ts';
import { reportError } from './api.ts';

export const ERROR_MODAL_MESSAGE =
  'An error has occurred. Please click Report an issue to report this error.';

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
    // Sanitized once, which also bounds every field to its schema limit;
    // the dedup check and the sender share the result.
    const telemetry = sanitizeErrorTelemetry({
      url,
      timestamp: new Date().toISOString(),
      message: errorMessage(error),
      // The class name heads the stack (Firefox and Safari leave it out; with
      // no stack it stands alone), so it reaches the title and fingerprint
      // whatever the browser.
      ...(error instanceof Error
        ? { stackTrace: stackWithHeader(error.name, error.stack) }
        : {}),
    });
    if (shouldSkipDuplicateTelemetryReport(telemetry))
      return { ok: true, value: { ok: true } };
    return await reportError(telemetry);
  } catch {
    return { ok: false, error: 'network' };
  }
}
