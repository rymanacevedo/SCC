import {
  sanitizeStackTrace,
  type StackSanitizeOptions,
  stackSummary,
} from './stackFrames.ts';
import {
  omittedText,
  SANITIZE_INPUT_FACTOR,
  toRouteUrl,
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

/**
 * A User report: the page and the time, nothing the user typed. An older
 * client may still send a `description`; the object schema strips unknown
 * keys, so it is dropped here, before any sink sees it.
 */
const userIssueReport = cappedReport({
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

// The time a report carries when its own cannot be parsed, so the result is
// still a valid ISO datetime for the report schemas.
const UNKNOWN_TIME = new Date(0).toISOString();

/**
 * A report timestamp as a canonical ISO string, so its length is bounded
 * (the schema accepts long fractional seconds); otherwise the epoch.
 */
export function sanitizeReportTimestamp(timestamp: string): string {
  const time = Date.parse(timestamp);
  return Number.isNaN(time) ? UNKNOWN_TIME : new Date(time).toISOString();
}

/**
 * A report URL as the app route pattern it matched, under the synthetic
 * `https://app.invalid` origin (`https://app.invalid/summary`), or
 * `https://app.invalid/[unknown-route]`. No real host or path segment is
 * kept, and the result is far shorter than its limit, so a sanitized report
 * always passes its schema. Input past four times the limit is never read.
 */
export function sanitizeReportUrl(url: string): string {
  return toRouteUrl(
    url.slice(0, REPORT_FIELD_LIMITS.url * SANITIZE_INPUT_FACTOR),
  );
}

/**
 * The only form of Error telemetry that may be sent, stored or fingerprinted:
 * the canonical timestamp, the route-pattern URL and the canonical stack (the
 * error name and frames). The message is free text, so only its length is
 * kept. Every field fits its schema limit. The browser and the Worker each
 * pass the asset paths the build published (`options.knownAssets`), so only a
 * file the app ships is kept in a frame, before the report leaves the page.
 */
export function sanitizeErrorTelemetry(
  telemetry: ErrorTelemetryPayload,
  options: StackSanitizeOptions,
): SanitizedErrorTelemetry {
  return {
    timestamp: sanitizeReportTimestamp(telemetry.timestamp),
    url: sanitizeReportUrl(telemetry.url),
    message: omittedText('message', telemetry.message),
    ...(telemetry.stackTrace === undefined
      ? {}
      : {
          stackTrace: sanitizeStackTrace(
            telemetry.stackTrace,
            REPORT_FIELD_LIMITS.stackTrace,
            options,
          ),
        }),
  } as SanitizedErrorTelemetry;
}

/**
 * The only form of a User report that may be sent or stored: the canonical
 * timestamp and the route-pattern URL.
 */
export function sanitizeUserIssueReport(
  report: UserIssueReportPayload,
): SanitizedUserIssueReport {
  return {
    timestamp: sanitizeReportTimestamp(report.timestamp),
    url: sanitizeReportUrl(report.url),
  } as SanitizedUserIssueReport;
}

// How many top frames identify an error: enough to tell call sites apart,
// few enough that a deep recursion difference does not split one error.
const FINGERPRINT_FRAME_COUNT = 5;

/**
 * The error name, route and top frames' files of sanitized telemetry: what
 * makes two reports the same error. Frames carry no function names, and
 * their line and column are left out, as are asset content hashes, so a new
 * build does not split one error. Takes already-sanitized telemetry, so a
 * caller sanitizes once and every use (the dedup lookup, the issue body)
 * sees the same fingerprint.
 */
export function buildSanitizedTelemetryFingerprint(
  telemetry: SanitizedErrorTelemetry,
): string {
  const { name, files } = stackSummary(
    telemetry.stackTrace ?? '',
    FINGERPRINT_FRAME_COUNT,
  );
  return JSON.stringify({ name, url: telemetry.url, files });
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
