import {
  reportAcknowledgementSchema,
  type SanitizedErrorTelemetry,
  type SanitizedUserIssueReport,
} from '../shared/errorReporting.ts';
import type { FailureCode, Result } from '../shared/result.ts';
import {
  ExperienceSchema,
  type GenerationRequest,
  SkillsSchema,
  SummarySchema,
} from '../shared/schemas/generation.ts';
import type { z } from '../shared/zod.ts';

const failureCodeByStatus: Record<number, FailureCode> = {
  400: 'validation',
  403: 'forbidden',
  404: 'not-found',
  405: 'method',
  415: 'media-type',
};
async function post<T>(
  path: string,
  body: unknown,
  schema: z.ZodMiniType<T>,
  signal?: AbortSignal,
): Promise<Result<T>> {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok)
      return {
        ok: false,
        error: failureCodeByStatus[response.status] ?? 'server',
        status: response.status,
      };
    let output: unknown;
    try {
      output = await response.json();
    } catch {
      return { ok: false, error: signal?.aborted ? 'aborted' : 'validation' };
    }
    const parsed = schema.safeParse(output);
    return parsed.success
      ? { ok: true, value: parsed.data }
      : { ok: false, error: 'validation' };
  } catch {
    return { ok: false, error: signal?.aborted ? 'aborted' : 'network' };
  }
}
export const createSummaries = (
  input: GenerationRequest,
  signal?: AbortSignal,
) => post('/api/summaries', input, SummarySchema, signal);
export const createSkills = (input: GenerationRequest, signal?: AbortSignal) =>
  post('/api/skills', input, SkillsSchema, signal);
export const createExperience = (
  input: GenerationRequest,
  signal?: AbortSignal,
) => post('/api/experience', input, ExperienceSchema, signal);
// Every report leaves the browser as route patterns, redacted and truncated, exactly
// once. The Worker sanitizes again; this keeps the data off the wire. Both
// senders take an already-sanitized report (the caller sanitizes once and may
// reuse the value, as the Error telemetry dedup does); the branded types make
// a raw payload a compile error.
export const reportError = (
  input: SanitizedErrorTelemetry,
  signal?: AbortSignal,
) => post('/api/errors', input, reportAcknowledgementSchema, signal);
export const reportIssue = (
  input: SanitizedUserIssueReport,
  signal?: AbortSignal,
) => post('/api/report-issue', input, reportAcknowledgementSchema, signal);
