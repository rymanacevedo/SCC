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

export const REPORT_FIELD_LIMITS = {
  timestamp: 64,
  url: 2_048,
  message: 1_000,
  stackTrace: 16_000,
} as const;

type CappedField = {
  maxLength: number;
  schema: (maxLength: number) => z.ZodMiniType;
};

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
export const ERROR_TELEMETRY_MAX_LENGTH = errorTelemetry.maxLength;

const userIssueReport = cappedReport({
  timestamp: timestampField,
  url: {
    maxLength: REPORT_FIELD_LIMITS.url,
    schema: (maxLength: number) => z.url().check(z.maxLength(maxLength)),
  },
});
export const userIssueReportSchema = userIssueReport.schema;
export const USER_ISSUE_REPORT_MAX_LENGTH = userIssueReport.maxLength;

export type ErrorTelemetryPayload = z.infer<typeof errorTelemetrySchema>;
export type UserIssueReportPayload = z.infer<typeof userIssueReportSchema>;

declare const sanitized: unique symbol;
export type SanitizedErrorTelemetry = ErrorTelemetryPayload & {
  readonly [sanitized]: true;
};
export type SanitizedUserIssueReport = UserIssueReportPayload & {
  readonly [sanitized]: true;
};

const UNKNOWN_TIME = new Date(0).toISOString();

export function sanitizeReportTimestamp(timestamp: string): string {
  const time = Date.parse(timestamp);
  return Number.isNaN(time) ? UNKNOWN_TIME : new Date(time).toISOString();
}

export function sanitizeReportUrl(url: string): string {
  return toRouteUrl(
    url.slice(0, REPORT_FIELD_LIMITS.url * SANITIZE_INPUT_FACTOR),
  );
}

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

export function sanitizeUserIssueReport(
  report: UserIssueReportPayload,
): SanitizedUserIssueReport {
  return {
    timestamp: sanitizeReportTimestamp(report.timestamp),
    url: sanitizeReportUrl(report.url),
  } as SanitizedUserIssueReport;
}

const FINGERPRINT_FRAME_COUNT = 5;

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
