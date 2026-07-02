import { describe, expect, test } from 'bun:test';
import { validateOpenAiEnvironment } from '../../lib/environment';
import { DEFAULT_MODEL, resolveModel } from './model';

type InspectableModel = {
  modelId: string;
  config: {
    url: (args: { path: string; modelId: string }) => string;
  };
};

describe('resolveModel', () => {
  test('falls back to DEFAULT_MODEL when OPENAI_MODEL is unset', () => {
    const env = validateOpenAiEnvironment({
      OPENAI_API_KEY: 'openai-123',
    });

    const model = resolveModel(env) as unknown as InspectableModel;

    expect(model.modelId).toBe(DEFAULT_MODEL);
  });

  test('uses the configured model id and base URL when provided', () => {
    const env = validateOpenAiEnvironment({
      OPENAI_API_KEY: 'openai-123',
      OPENAI_BASE_URL: 'http://localhost:11434/v1',
      OPENAI_MODEL: 'llama3.1',
    });

    const model = resolveModel(env) as unknown as InspectableModel;

    expect(model.modelId).toBe('llama3.1');
    expect(model.config.url({ path: '/responses', modelId: model.modelId })).toBe(
      'http://localhost:11434/v1/responses',
    );
  });
});
