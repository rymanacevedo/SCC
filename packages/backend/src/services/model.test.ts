import { describe, expect, test } from 'bun:test';
import { DEFAULT_MODEL, resolveModel } from './model';

type ModelWithConfig = {
  modelId: string;
  config: {
    url: (options: { path: string; modelId: string }) => string;
  };
};

describe('resolveModel', () => {
  test('falls back to the default model id when OPENAI_MODEL is unset', () => {
    const model = resolveModel({
      OPENAI_API_KEY: 'openai-123',
    }) as unknown as ModelWithConfig;

    expect(model.modelId).toBe(DEFAULT_MODEL);
  });

  test('passes OPENAI_BASE_URL through to the resolved model', () => {
    const model = resolveModel({
      OPENAI_API_KEY: 'openai-123',
      OPENAI_BASE_URL: 'http://localhost:11434/v1',
      OPENAI_MODEL: 'local-model',
    }) as unknown as ModelWithConfig;

    expect(model.modelId).toBe('local-model');
    expect(
      model.config.url({ path: '/responses', modelId: 'local-model' }),
    ).toBe('http://localhost:11434/v1/responses');
  });
});
