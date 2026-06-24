import { z } from 'zod';

export const errorTelemetrySchema = z.object({
  timestamp: z.string().datetime(),
  url: z.string().min(1),
  message: z.string().min(1),
  stackTrace: z.string().optional(),
});

export const userIssueReportSchema = z.object({
  description: z.string().trim().min(1),
  timestamp: z.string().datetime(),
  url: z.string().url(),
});

export type ErrorTelemetryPayload = z.infer<typeof errorTelemetrySchema>;
export type UserIssueReportPayload = z.infer<typeof userIssueReportSchema>;

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
