import { MockLanguageModelV4 } from 'ai/test';

export function createMockJsonModel(output: unknown) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify(output),
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
}
