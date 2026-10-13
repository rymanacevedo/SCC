import { describe, expect, test } from 'bun:test';
import { createMockModel } from '../../test/mock-model';
import { createSummaries } from './ai';

describe('createSummaries', () => {
  test('returns schema-shaped output with an injected language model', async () => {
    const model = createMockModel({
      summaries: [
        {
          title: 'Software Developer',
          text: 'Builds reliable web applications with measurable results.',
        },
      ],
    });

    const result = await createSummaries(
      '<job><jobTitle>Software Developer</jobTitle></job>',
      model,
    );

    expect(result).toEqual([
      {
        title: 'Software Developer',
        text: 'Builds reliable web applications with measurable results.',
      },
    ]);
  });
});
