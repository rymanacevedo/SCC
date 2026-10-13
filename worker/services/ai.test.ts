import { describe, expect, test } from 'bun:test';
import { createMockJsonModel } from '../../test/mock-model.ts';
import { createSummaries } from './ai.ts';

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
