import { describe, expect, test } from 'bun:test';
import { MockLanguageModelV3 } from 'ai/test';
import { createSummaries } from './ai';

describe('createSummaries', () => {
  test('returns schema-shaped output with an injected language model', async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              summaries: [
                {
                  title: 'Software Developer',
                  text: 'Builds reliable web applications with measurable results.',
                },
              ],
            }),
          },
        ],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: {
            total: 10,
            noCache: 10,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: 20,
            text: 20,
            reasoning: undefined,
          },
        },
        warnings: [],
      }),
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
