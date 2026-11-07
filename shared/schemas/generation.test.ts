import { expect, test } from 'bun:test';
import { zodSchema } from 'ai';
import {
  ExperienceSchema,
  exceedsGeneratedOutputLimits,
  GENERATED_OUTPUT_LIMITS,
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

test('generated output is within its limits at exactly 50 items of 2,000 characters', () => {
  expect(GENERATED_OUTPUT_LIMITS).toEqual({ items: 50, length: 2_000 });
  const text = 'x'.repeat(2_000);
  const items = Array.from({ length: 50 }, () => text);
  expect(
    exceedsGeneratedOutputLimits({ expertRecommended: items, other: items }),
  ).toBe(false);
  expect(
    exceedsGeneratedOutputLimits({
      summaries: items.map(() => ({ title: text, text })),
    }),
  ).toBe(false);
});

test('generated output one item or one character over a limit exceeds it, wherever it sits', () => {
  const items = (count: number, length = 10) =>
    Array.from({ length: count }, () => 'x'.repeat(length));
  for (const output of [
    { expertRecommended: items(51), other: [] },
    { expertRecommended: [], other: items(51) },
    { expertRecommended: items(1, 2_001), other: [] },
    { summaries: items(51).map((title) => ({ title, text: title })) },
    { summaries: [{ title: 'Developer', text: 'x'.repeat(2_001) }] },
    [{ title: 'x'.repeat(2_001), text: 'Developer' }],
  ])
    expect(exceedsGeneratedOutputLimits(output)).toBe(true);
});
