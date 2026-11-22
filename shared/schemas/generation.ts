import { z } from '../zod.ts';

export const GENERATED_OUTPUT_LIMITS = { items: 50, length: 2_000 } as const;

function outputCaps(bounded: boolean) {
  const { items, length } = GENERATED_OUTPUT_LIMITS;
  return {
    text: <S extends z.ZodMiniString>(schema: S) =>
      bounded ? schema.check(z.maxLength(length)) : schema,
    list: <S extends z.ZodMiniArray>(schema: S) =>
      bounded ? schema.check(z.maxLength(items)) : schema,
  };
}

function suggestionsSchema(kind: string, bounded = false) {
  const { text, list } = outputCaps(bounded);
  return z.object({
    expertRecommended: list(z.array(text(z.string()))).check(
      z.describe(`The top 5 ${kind} necessary for the job.`),
    ),
    other: list(
      z.array(
        text(z.string()).check(
          z.describe(`The other ${kind} necessary for the job.`),
        ),
      ),
    ),
  });
}

function summarySchema(bounded = false) {
  const { text, list } = outputCaps(bounded);
  return list(
    z.array(
      z.object({
        title: text(z.string()).check(z.describe('The job description title.')),
        text: text(z.string()).check(
          z.describe(
            'A summary of the profession. This is roughly 3-4 sentences. No more then 5 sentences.',
          ),
        ),
      }),
    ),
  );
}

export const SkillsSchema = suggestionsSchema('skills');
export const ExperienceSchema = suggestionsSchema('experience');
export const SummarySchema = summarySchema();

export const BoundedSkillsSchema = suggestionsSchema('skills', true);
export const BoundedExperienceSchema = suggestionsSchema('experience', true);
export const BoundedSummarySchema = summarySchema(true);

export const MAX_PROMPT_LENGTH = 50_000;

export const generationRequestSchema = z.object({
  prompt: z.string().check(z.minLength(1), z.maxLength(MAX_PROMPT_LENGTH)),
});
export type GenerationRequest = z.infer<typeof generationRequestSchema>;
