import { expect, test } from 'bun:test';
import { zodSchema } from 'ai';
import {
  ExperienceSchema,
  generationRequestSchema,
  MAX_PROMPT_LENGTH,
  SkillsSchema,
  SummarySchema,
} from './generation.ts';

// Expected values were captured from the full `zod` build before the client moved to `zod/mini`.
const jsonSchemaFor = async (schema: Parameters<typeof zodSchema>[0]) =>
  await zodSchema(schema).jsonSchema;

const suggestions = (kind: string) => ({
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    expertRecommended: {
      type: 'array',
      items: { type: 'string' },
      description: `The top 5 ${kind} necessary for the job.`,
    },
    other: {
      type: 'array',
      items: {
        type: 'string',
        description: `The other ${kind} necessary for the job.`,
      },
    },
  },
  required: ['expertRecommended', 'other'],
  additionalProperties: false,
});

test('the model is asked for summaries with their descriptions', async () => {
  expect(await jsonSchemaFor(SummarySchema)).toEqual({
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The job description title.' },
        text: {
          type: 'string',
          description:
            'A summary of the profession. This is roughly 3-4 sentences. No more then 5 sentences.',
        },
      },
      required: ['title', 'text'],
      additionalProperties: false,
    },
  });
});

test('the model is asked for skills with their descriptions', async () => {
  expect(await jsonSchemaFor(SkillsSchema)).toEqual(suggestions('skills'));
});

test('the model is asked for experience with their descriptions', async () => {
  expect(await jsonSchemaFor(ExperienceSchema)).toEqual(
    suggestions('experience'),
  );
});

test('a Generation request prompt is accepted up to its cap and refused one character over', () => {
  expect(MAX_PROMPT_LENGTH).toBe(50_000);
  const at = generationRequestSchema.safeParse({ prompt: 'x'.repeat(50_000) });
  expect(at.success).toBe(true);
  const over = generationRequestSchema.safeParse({
    prompt: 'x'.repeat(50_001),
  });
  expect(over.success).toBe(false);
  expect(generationRequestSchema.safeParse({ prompt: '' }).success).toBe(false);
});
