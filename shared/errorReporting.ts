import { z } from './zod.ts';

export const reportAcknowledgementSchema = z.object({ ok: z.literal(true) });

/**
 * The longest each report field may be, in UTF-16 code units. Well above real
 * values; together they keep an auto-reported issue body, which repeats the URL,
 * message and stack trace in its fingerprint, under GitHub's 65,536 characters.
 */
export const REPORT_FIELD_LIMITS = {
  /** An ISO datetime is under 40; the cap stops unbounded fractional seconds. */
  timestamp: 64,
  url: 2_048,
  message: 1_000,
  stackTrace: 16_000,
  description: 10_000,
} as const;

const timestampSchema = z.iso
  .datetime()
  .check(z.maxLength(REPORT_FIELD_LIMITS.timestamp));

export const errorTelemetrySchema = z.object({
  timestamp: timestampSchema,
  url: z.string().check(z.minLength(1), z.maxLength(REPORT_FIELD_LIMITS.url)),
  message: z
    .string()
    .check(z.minLength(1), z.maxLength(REPORT_FIELD_LIMITS.message)),
  stackTrace: z.optional(
    z.string().check(z.maxLength(REPORT_FIELD_LIMITS.stackTrace)),
  ),
});

export const userIssueReportSchema = z.object({
  description: z
    .string()
    .check(
      z.trim(),
      z.minLength(1),
      z.maxLength(REPORT_FIELD_LIMITS.description),
    ),
  timestamp: timestampSchema,
  url: z.url().check(z.maxLength(REPORT_FIELD_LIMITS.url)),
});

/** Sums the field limits of one report schema, so callers never repeat its fields. */
const totalLength = (fields: (keyof typeof REPORT_FIELD_LIMITS)[]) =>
  fields.reduce((total, field) => total + REPORT_FIELD_LIMITS[field], 0);
/** The most code units an error telemetry body's strings can hold together. */
export const ERROR_TELEMETRY_MAX_LENGTH = totalLength([
  'timestamp',
  'url',
  'message',
  'stackTrace',
]);
/** The most code units a user issue report body's strings can hold together. */
export const USER_ISSUE_REPORT_MAX_LENGTH = totalLength([
  'timestamp',
  'url',
  'description',
]);

export type ErrorTelemetryPayload = z.infer<typeof errorTelemetrySchema>;
export type UserIssueReportPayload = z.infer<typeof userIssueReportSchema>;

/**
 * Truncates telemetry to the field limits, so an unusually long error is still
 * reported instead of refused by the Worker.
 */
export function boundTelemetry(
  telemetry: ErrorTelemetryPayload,
): ErrorTelemetryPayload {
  return {
    ...telemetry,
    url: telemetry.url.slice(0, REPORT_FIELD_LIMITS.url),
    message: telemetry.message.slice(0, REPORT_FIELD_LIMITS.message),
    ...(telemetry.stackTrace === undefined
      ? {}
      : {
          stackTrace: telemetry.stackTrace.slice(
            0,
            REPORT_FIELD_LIMITS.stackTrace,
          ),
        }),
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

export function buildTelemetryFingerprint(
  telemetry: ErrorTelemetryPayload,
): string {
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
