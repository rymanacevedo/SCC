import {
  sanitizeErrorTelemetry,
  shouldSkipDuplicateTelemetryReport,
} from '../shared/errorReporting.ts';
import type { Result } from '../shared/result.ts';
import { stackWithHeader } from '../shared/stackFrames.ts';
import { reportError } from './api.ts';
import { loadKnownAssets } from './report-assets.ts';

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
  knownAssets: () => Promise<ReadonlySet<string>> = loadKnownAssets,
): Promise<Result<{ ok: true }>> {
  try {
    if (isNotFoundResponse(error)) return { ok: true, value: { ok: true } };
    const timestamp = new Date().toISOString();
    const telemetry = sanitizeErrorTelemetry(
      {
        url,
        timestamp,
        message: errorMessage(error),
        ...(error instanceof Error
          ? { stackTrace: stackWithHeader(error.name, error.stack) }
          : {}),
      },
      { knownAssets: await knownAssets() },
    );
    if (shouldSkipDuplicateTelemetryReport(telemetry))
      return { ok: true, value: { ok: true } };
    return await reportError(telemetry);
  } catch {
    return { ok: false, error: 'network' };
  }
}
