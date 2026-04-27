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
