import { truncateText } from './text.ts';
import { z } from './zod.ts';

export const reportAcknowledgementSchema = z.object({ ok: z.literal(true) });

/**
 * The longest each report field may be, in UTF-16 code units. Well above real
 * values. The Worker separately bounds the GitHub issue body it renders, since
 * the fingerprint JSON-escapes these fields.
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
    /** Cuts every string field to its limit; other fields pass through. */
    truncate<T extends Record<string, unknown>>(report: T): T {
      return Object.fromEntries(
        Object.entries(report).map(([key, value]) => {
          const limit = fields[key]?.maxLength;
          return [
            key,
            typeof value === 'string' && limit !== undefined
              ? truncateText(value, limit)
              : value,
          ];
        }),
      ) as T;
    },
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

/**
 * Truncates telemetry to the field limits, so an unusually long error is still
 * reported instead of refused by the Worker.
 */
export function boundTelemetry(
  telemetry: ErrorTelemetryPayload,
): ErrorTelemetryPayload {
  return errorTelemetry.truncate(telemetry);
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
