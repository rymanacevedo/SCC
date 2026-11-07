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
export const REPORT_FIELD_MAX = {
  url: 2_000,
  message: 1_000,
  stackTrace: 8_000,
  description: 8_000,
} as const;

declare const sanitized: unique symbol;
/** Error telemetry that has been through sanitizeErrorTelemetry. */
export type SanitizedErrorTelemetry = ErrorTelemetryPayload & {
  readonly [sanitized]: true;
};

/** A report URL reduced to origin + path, redacted and truncated. */
export function sanitizeReportUrl(url: string): string {
  return sanitizeTelemetryText(toPathOnlyUrl(url), REPORT_FIELD_MAX.url);
}

/** The only form of Error telemetry that may be sent, stored or fingerprinted. */
export function sanitizeErrorTelemetry(
  telemetry: ErrorTelemetryPayload,
): SanitizedErrorTelemetry {
  return {
    timestamp: telemetry.timestamp,
    url: sanitizeReportUrl(telemetry.url),
    message: sanitizeTelemetryText(telemetry.message, REPORT_FIELD_MAX.message),
    ...(telemetry.stackTrace === undefined
      ? {}
      : {
          stackTrace: sanitizeTelemetryText(
            telemetry.stackTrace,
            REPORT_FIELD_MAX.stackTrace,
          ),
        }),
  } as SanitizedErrorTelemetry;
}

/** The only form of a User report that may be sent or stored. */
export function sanitizeUserIssueReport(
  report: UserIssueReportPayload,
): UserIssueReportPayload {
  return {
    timestamp: report.timestamp,
    url: sanitizeReportUrl(report.url),
    description: sanitizeTelemetryText(
      report.description,
      REPORT_FIELD_MAX.description,
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

/**
 * Computed on sanitized values, so query strings and redacted data never split
 * it. Takes already-sanitized telemetry so a caller sanitizes once and every
 * use (the dedup lookup, the issue body) sees the same fingerprint.
 */
export function buildSanitizedTelemetryFingerprint(
  telemetry: SanitizedErrorTelemetry,
): string {
  return JSON.stringify({
    url: normalizeTelemetryFingerprintValue(telemetry.url),
    message: telemetry.message,
    stackTrace: normalizeTelemetryFingerprintValue(telemetry.stackTrace ?? ''),
  });
}

const TELEMETRY_DEDUPLICATION_WINDOW_MS = 1_000;
const recentlyReportedErrors = new Map<string, number>();

/** Takes sanitized telemetry: the caller sanitizes once, then dedups and sends. */
export function shouldSkipDuplicateTelemetryReport(
  telemetry: SanitizedErrorTelemetry,
  now = Date.now(),
): boolean {
  for (const [fingerprint, timestamp] of recentlyReportedErrors) {
    if (now - timestamp > TELEMETRY_DEDUPLICATION_WINDOW_MS)
      recentlyReportedErrors.delete(fingerprint);
  }
  const fingerprint = buildSanitizedTelemetryFingerprint(telemetry);
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
