import { z } from '../zod.ts';

export const SkillsSchema = z.object({
  expertRecommended: z
    .array(z.string())
    .check(z.describe('The top 5 skills necessary for the job.')),
  other: z.array(
    z.string().check(z.describe('The other skills necessary for the job.')),
  ),
});

export const ExperienceSchema = z.object({
  expertRecommended: z
    .array(z.string())
    .check(z.describe('The top 5 experience necessary for the job.')),
  other: z.array(
    z.string().check(z.describe('The other experience necessary for the job.')),
  ),
});

export const SummarySchema = z.array(
  z.object({
    title: z.string().check(z.describe('The job description title.')),
    text: z
      .string()
      .check(
        z.describe(
          'A summary of the profession. This is roughly 3-4 sentences. No more then 5 sentences.',
        ),
      ),
  }),
);

/**
 * Caps on a section generator's result: at most `items` entries in any array
 * and `length` code units in any string. Far above a real section (top 5
 * suggestions, a summary of a few sentences per job). Checked by the Worker
 * after the model returns, never sent to the provider, whose JSON Schema stays
 * unchanged for strict structured outputs.
 */
export const GENERATED_OUTPUT_LIMITS = { items: 50, length: 2_000 } as const;

/** Whether any array or string anywhere in `output` is over its limit. */
export function exceedsGeneratedOutputLimits(output: unknown): boolean {
  if (typeof output === 'string')
    return output.length > GENERATED_OUTPUT_LIMITS.length;
  if (Array.isArray(output))
    return (
      output.length > GENERATED_OUTPUT_LIMITS.items ||
      output.some(exceedsGeneratedOutputLimits)
    );
  if (output !== null && typeof output === 'object')
    return Object.values(output).some(exceedsGeneratedOutputLimits);
  return false;
}

/**
 * The longest prompt a Generation request may carry, in UTF-16 code units. A
 * full resume's jobs serialize to a few thousand; this bounds Worker CPU and the
 * provider payload without refusing a real one.
 */
export const MAX_PROMPT_LENGTH = 50_000;

export const generationRequestSchema = z.object({
  prompt: z.string().check(z.minLength(1), z.maxLength(MAX_PROMPT_LENGTH)),
});
export type GenerationRequest = z.infer<typeof generationRequestSchema>;
