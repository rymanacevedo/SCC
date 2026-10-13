import type { z } from 'zod';
import {
  type ErrorTelemetryPayload,
  reportAcknowledgementSchema,
  type UserIssueReportPayload,
} from '../shared/errorReporting.ts';
import type { FailureCode, Result } from '../shared/result.ts';
import {
  ExperienceSchema,
  type GenerationRequest,
  SkillsSchema,
  SummarySchema,
} from '../shared/schemas/generation.ts';

const statuses: Record<number, FailureCode> = {
  400: 'validation',
  403: 'forbidden',
  404: 'not-found',
  405: 'method',
  415: 'media-type',
};
async function post<T>(
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
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
        error: statuses[response.status] ?? 'server',
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
export const reportError = (
  input: ErrorTelemetryPayload,
  signal?: AbortSignal,
) => post('/api/errors', input, reportAcknowledgementSchema, signal);
export const reportIssue = (
  input: UserIssueReportPayload,
  signal?: AbortSignal,
) => post('/api/report-issue', input, reportAcknowledgementSchema, signal);
