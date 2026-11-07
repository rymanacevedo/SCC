import { z } from '../zod.ts';

/**
 * Caps on a section generator's result: at most `items` entries in any array
 * and `length` code units in any string. Far above a real section (top 5
 * suggestions, a summary of a few sentences per job).
 */
export const GENERATED_OUTPUT_LIMITS = { items: 50, length: 2_000 } as const;

/**
 * Each output shape is declared once and built twice. The provider gets the
 * unbounded schema: strict-mode structured outputs may reject `maxItems` and
 * `maxLength` in its JSON Schema. The bounded schema, with the Generated output
 * limits on every array and string, is the Worker's own check of the result.
 */
function outputCaps(bounded: boolean) {
  const { items, length } = GENERATED_OUTPUT_LIMITS;
  return {
    text: <S extends z.ZodMiniString>(schema: S) =>
      bounded ? schema.check(z.maxLength(length)) : schema,
    list: <S extends z.ZodMiniArray>(schema: S) =>
      bounded ? schema.check(z.maxLength(items)) : schema,
  };
}

/** Skills and Experience share one shape: the expert's top picks, then others. */
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
