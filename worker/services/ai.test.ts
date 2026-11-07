import { describe, expect, test } from 'bun:test';
import { createMockJsonModel } from '../../test/mock-model.ts';
import { createExperience, createSkills, createSummaries } from './ai.ts';

describe('createSummaries', () => {
  test('returns schema-shaped output with an injected language model', async () => {
    const summaries = [
      {
        title: 'Software Developer',
        text: 'Builds reliable web applications with measurable results.',
      },
    ];
    const model = createMockJsonModel({ summaries });

    const result = await createSummaries(
      '<job><jobTitle>Software Developer</jobTitle></job>',
      model,
    );

    expect(result).toEqual(summaries);
  });
});

test('every section generator caps the output tokens it asks the model for', async () => {
  const suggestions = { expertRecommended: [], other: [] };
  for (const [generate, output] of [
    [createSummaries, { summaries: [] }],
    [createSkills, suggestions],
    [createExperience, suggestions],
  ] as const) {
    const model = createMockJsonModel(output);
    await generate('<job><jobTitle>Developer</jobTitle></job>', model);
    expect(model.doGenerateCalls[0]?.maxOutputTokens).toBe(16_000);
  }
});
