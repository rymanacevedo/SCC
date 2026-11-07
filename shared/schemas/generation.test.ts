import { expect, test } from 'bun:test';
import { zodSchema } from 'ai';
import {
  BoundedExperienceSchema,
  BoundedSkillsSchema,
  BoundedSummarySchema,
  ExperienceSchema,
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

const strings = (count: number, length = 10) =>
  Array.from({ length: count }, () => 'x'.repeat(length));
const summaries = (count: number, length = 10) =>
  strings(count, length).map((text) => ({ title: text, text }));

test('the Generated output limits are 50 items and 2,000 characters', () => {
  expect(GENERATED_OUTPUT_LIMITS).toEqual({ items: 50, length: 2_000 });
});

for (const [name, schema] of [
  ['skills', BoundedSkillsSchema],
  ['experience', BoundedExperienceSchema],
] as const)
  test(`bounded ${name} accepts 50 items of 2,000 characters and refuses one more of either`, () => {
    const atLimit = strings(50, 2_000);
    expect(
      schema.safeParse({ expertRecommended: atLimit, other: atLimit }).success,
    ).toBe(true);
    for (const output of [
      { expertRecommended: strings(51), other: [] },
      { expertRecommended: [], other: strings(51) },
      { expertRecommended: strings(1, 2_001), other: [] },
      { expertRecommended: [], other: strings(1, 2_001) },
    ])
      expect(schema.safeParse(output).success).toBe(false);
  });

test('bounded summaries accept 50 summaries of 2,000 characters and refuse one more of either', () => {
  expect(BoundedSummarySchema.safeParse(summaries(50, 2_000)).success).toBe(
    true,
  );
  for (const output of [
    summaries(51),
    [{ title: 'x'.repeat(2_001), text: 'Developer' }],
    [{ title: 'Developer', text: 'x'.repeat(2_001) }],
  ])
    expect(BoundedSummarySchema.safeParse(output).success).toBe(false);
});

test('the unbounded schemas the provider gets accept any size', () => {
  const huge = strings(51, 2_001);
  expect(
    SkillsSchema.safeParse({ expertRecommended: huge, other: huge }).success,
  ).toBe(true);
  expect(SummarySchema.safeParse(summaries(51, 2_001)).success).toBe(true);
});
