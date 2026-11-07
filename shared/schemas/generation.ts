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
 * The longest prompt a Generation request may carry, in UTF-16 code units. A
 * full resume's jobs serialize to a few thousand; this bounds Worker CPU and the
 * provider payload without refusing a real one.
 */
export const MAX_PROMPT_LENGTH = 50_000;

export const generationRequestSchema = z.object({
  prompt: z.string().check(z.minLength(1), z.maxLength(MAX_PROMPT_LENGTH)),
});
export type GenerationRequest = z.infer<typeof generationRequestSchema>;
