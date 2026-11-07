import { sanitizeStackTrace } from './stackFrames.ts';
import {
  REDACTED,
  SANITIZE_INPUT_FACTOR,
  sanitizeTelemetryText,
  toPathOnlyUrl,
  truncateWithMarker,
} from './telemetryRedaction.ts';
import { z } from './zod.ts';

export const reportAcknowledgementSchema = z.object({ ok: z.literal(true) });

/**
 * The longest each report field may be, in UTF-16 code units. Well above real
 * values. The schemas refuse anything longer, and sanitizing cuts every field
 * to fit, marker included. The Worker separately bounds the GitHub issue body
 * it renders.
 */
export const REPORT_FIELD_LIMITS = {
  /** An ISO datetime is under 40; the cap stops unbounded fractional seconds. */
  timestamp: 64,
  url: 2_048,
  message: 1_000,
  stackTrace: 16_000,
  description: 10_000,
} as const;

type CappedField = {
  maxLength: number;
  /** Builds the field's schema with `maxLength` applied. */
  schema: (maxLength: number) => z.ZodMiniType;
};

/**
 * Builds a report schema and the most code units its strings can hold together
 * from one field map, so the schema and its total cannot drift apart.
 */
function cappedReport<const F extends Record<string, CappedField>>(fields: F) {
  const entries = Object.entries(fields);
  const shape = Object.fromEntries(
    entries.map(([key, field]) => [key, field.schema(field.maxLength)]),
  ) as { [K in keyof F]: ReturnType<F[K]['schema']> };
  return {
    schema: z.object(shape),
    maxLength: entries.reduce((total, [, field]) => total + field.maxLength, 0),
  };
}

const timestampField = {
  maxLength: REPORT_FIELD_LIMITS.timestamp,
  schema: (maxLength: number) => z.iso.datetime().check(z.maxLength(maxLength)),
};

const errorTelemetry = cappedReport({
  timestamp: timestampField,
  url: {
    maxLength: REPORT_FIELD_LIMITS.url,
    schema: (maxLength: number) =>
      z.string().check(z.minLength(1), z.maxLength(maxLength)),
  },
  message: {
    maxLength: REPORT_FIELD_LIMITS.message,
    schema: (maxLength: number) =>
      z.string().check(z.minLength(1), z.maxLength(maxLength)),
  },
  stackTrace: {
    maxLength: REPORT_FIELD_LIMITS.stackTrace,
    schema: (maxLength: number) =>
      z.optional(z.string().check(z.maxLength(maxLength))),
  },
});
export const errorTelemetrySchema = errorTelemetry.schema;
/** The most code units an error telemetry body's strings can hold together. */
export const ERROR_TELEMETRY_MAX_LENGTH = errorTelemetry.maxLength;

const userIssueReport = cappedReport({
  description: {
    maxLength: REPORT_FIELD_LIMITS.description,
    schema: (maxLength: number) =>
      z.string().check(z.trim(), z.minLength(1), z.maxLength(maxLength)),
  },
  timestamp: timestampField,
  url: {
    maxLength: REPORT_FIELD_LIMITS.url,
    schema: (maxLength: number) => z.url().check(z.maxLength(maxLength)),
  },
});
export const userIssueReportSchema = userIssueReport.schema;
/** The most code units a user issue report body's strings can hold together. */
export const USER_ISSUE_REPORT_MAX_LENGTH = userIssueReport.maxLength;

export type ErrorTelemetryPayload = z.infer<typeof errorTelemetrySchema>;
export type UserIssueReportPayload = z.infer<typeof userIssueReportSchema>;

declare const sanitized: unique symbol;
/** Error telemetry that has been through sanitizeErrorTelemetry. */
export type SanitizedErrorTelemetry = ErrorTelemetryPayload & {
  readonly [sanitized]: true;
};
/** A User report that has been through sanitizeUserIssueReport. */
export type SanitizedUserIssueReport = UserIssueReportPayload & {
  readonly [sanitized]: true;
};

/**
 * A report timestamp as a canonical ISO string, so its length is bounded
 * (the schema accepts long fractional seconds); otherwise `[redacted]`.
 */
export function sanitizeReportTimestamp(timestamp: string): string {
  const time = Date.parse(timestamp);
  return Number.isNaN(time) ? REDACTED : new Date(time).toISOString();
}

/** A report URL as http(s) origin + path, cut to its limit; else `[redacted]`. */
export function sanitizeReportUrl(url: string): string {
  return truncateWithMarker(
    toPathOnlyUrl(
      url.slice(0, REPORT_FIELD_LIMITS.url * SANITIZE_INPUT_FACTOR),
    ),
    REPORT_FIELD_LIMITS.url,
  );
}

/**
 * The only form of Error telemetry that may be sent, stored or fingerprinted.
 * Every field fits its schema limit, so an unusually long error is still
 * reported instead of refused by the Worker.
 */
export function sanitizeErrorTelemetry(
  telemetry: ErrorTelemetryPayload,
): SanitizedErrorTelemetry {
  return {
    timestamp: sanitizeReportTimestamp(telemetry.timestamp),
    url: sanitizeReportUrl(telemetry.url),
    message: sanitizeTelemetryText(
      telemetry.message,
      REPORT_FIELD_LIMITS.message,
    ),
    ...(telemetry.stackTrace === undefined
      ? {}
      : {
          stackTrace: sanitizeStackTrace(
            telemetry.stackTrace,
            REPORT_FIELD_LIMITS.stackTrace,
          ),
        }),
  } as SanitizedErrorTelemetry;
}

/** The only form of a User report that may be sent or stored. */
export function sanitizeUserIssueReport(
  report: UserIssueReportPayload,
): SanitizedUserIssueReport {
  return {
    timestamp: sanitizeReportTimestamp(report.timestamp),
    url: sanitizeReportUrl(report.url),
    description: sanitizeTelemetryText(
      report.description,
      REPORT_FIELD_LIMITS.description,
    ),
  } as SanitizedUserIssueReport;
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
