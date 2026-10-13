import { z } from 'zod';

export const SkillsSchema = z.object({
  expertRecommended: z
    .array(z.string())
    .describe('The top 5 skills necessary for the job.'),
  other: z.array(
    z.string().describe('The other skills necessary for the job.'),
  ),
});

export const ExperienceSchema = z.object({
  expertRecommended: z
    .array(z.string())
    .describe('The top 5 experience necessary for the job.'),
  other: z.array(
    z.string().describe('The other experience necessary for the job.'),
  ),
});

export const SummarySchema = z
  .object({
    title: z.string().describe('The job description title.'),
    text: z
      .string()
      .describe(
        'A summary of the profession. This is roughly 3-4 sentences. No more then 5 sentences.',
      ),
  })
  .array();

export const generationRequestSchema = z.object({ prompt: z.string().min(1) });
export type GenerationRequest = z.infer<typeof generationRequestSchema>;
