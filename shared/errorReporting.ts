import { sanitizeTelemetryText, toPathOnlyUrl } from './telemetryRedaction.ts';
import { z } from './zod.ts';

export const reportAcknowledgementSchema = z.object({ ok: z.literal(true) });

export const errorTelemetrySchema = z.object({
  timestamp: z.iso.datetime(),
  url: z.string().check(z.minLength(1)),
  message: z.string().check(z.minLength(1)),
  stackTrace: z.optional(z.string()),
});

export const userIssueReportSchema = z.object({
  description: z.string().check(z.trim(), z.minLength(1)),
  timestamp: z.iso.datetime(),
  url: z.url(),
});

export type ErrorTelemetryPayload = z.infer<typeof errorTelemetrySchema>;
export type UserIssueReportPayload = z.infer<typeof userIssueReportSchema>;

// Per-field caps applied at write time, before a report is sent, stored in a
// GitHub issue, or fingerprinted. Together they stay far below GitHub's
// 65,536-character issue body limit.
export const TELEMETRY_FIELD_MAX = {
  url: 2_000,
  message: 1_000,
  stackTrace: 8_000,
  description: 8_000,
} as const;

function sanitizeReportUrl(url: string): string {
  return sanitizeTelemetryText(toPathOnlyUrl(url), TELEMETRY_FIELD_MAX.url);
}

/** The only form of error telemetry that may be sent, stored or fingerprinted. */
export function sanitizeErrorTelemetry(
  telemetry: ErrorTelemetryPayload,
): ErrorTelemetryPayload {
  return {
    timestamp: telemetry.timestamp,
    url: sanitizeReportUrl(telemetry.url),
    message: sanitizeTelemetryText(
      telemetry.message,
      TELEMETRY_FIELD_MAX.message,
    ),
    ...(telemetry.stackTrace === undefined
      ? {}
      : {
          stackTrace: sanitizeTelemetryText(
            telemetry.stackTrace,
            TELEMETRY_FIELD_MAX.stackTrace,
          ),
        }),
  };
}

/** The only form of a user report that may be sent or stored. */
export function sanitizeUserIssueReport(
  report: UserIssueReportPayload,
): UserIssueReportPayload {
  return {
    timestamp: report.timestamp,
    url: sanitizeReportUrl(report.url),
    description: sanitizeTelemetryText(
      report.description,
      TELEMETRY_FIELD_MAX.description,
    ),
  };
}

const STACK_COORDINATE_SUFFIX_PATTERN = /:\d+:\d+\b/g;
const HASHED_ASSET_FILENAME_PATTERN =
  /\/assets\/([^/?#/:]+)-[A-Za-z0-9_-]{6,}(\.[A-Za-z0-9]+)\b/g;

export function normalizeTelemetryFingerprintValue(value: string): string {
  return value
    .replace(STACK_COORDINATE_SUFFIX_PATTERN, '')
    .replace(HASHED_ASSET_FILENAME_PATTERN, '/assets/$1-[hash]$2');
}

/** Computed on sanitized values, so query strings and redacted data never split it. */
export function buildTelemetryFingerprint(
  payload: ErrorTelemetryPayload,
): string {
  const telemetry = sanitizeErrorTelemetry(payload);
  return JSON.stringify({
    url: normalizeTelemetryFingerprintValue(telemetry.url),
    message: telemetry.message,
    stackTrace: normalizeTelemetryFingerprintValue(telemetry.stackTrace ?? ''),
  });
}

const TELEMETRY_DEDUPLICATION_WINDOW_MS = 1_000;
const recentlyReportedErrors = new Map<string, number>();

export function shouldSkipDuplicateTelemetryReport(
  telemetry: ErrorTelemetryPayload,
  now = Date.now(),
): boolean {
  for (const [fingerprint, timestamp] of recentlyReportedErrors) {
    if (now - timestamp > TELEMETRY_DEDUPLICATION_WINDOW_MS)
      recentlyReportedErrors.delete(fingerprint);
  }
  const fingerprint = buildTelemetryFingerprint(telemetry);
  const previous = recentlyReportedErrors.get(fingerprint);
  if (
    previous !== undefined &&
    now - previous <= TELEMETRY_DEDUPLICATION_WINDOW_MS
  )
    return true;
  recentlyReportedErrors.set(fingerprint, now);
  return false;
}

export function resetReportedTelemetryForTests() {
  recentlyReportedErrors.clear();
}
