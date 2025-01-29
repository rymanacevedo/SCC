import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
const model = openai('gpt-3.5-turbo');
const schema = z.object({
  skills: z.object({
    expertRecommended: z
      .array(z.string())
      .describe('The top 5 skills necessary for the job.'),
    other: z.array(
      z.string().describe('The other skills necessary for the job.'),
    ),
  }),
});

export const createSkills = async (prompt: string) => {
  const result = await generateObject({
    model,
    schema,
    schemaName: 'Skills',
    prompt,
    system: `
        You are helping gather hard and soft skills for a specific job.
        When I give you the title, return the skills as a json object.
        Be as specific as possible.
        `,
    output: 'object',
  });

  return result.object;
};
