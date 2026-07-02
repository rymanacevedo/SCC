import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { OpenAiEnvSchema } from '../../lib/environment';

export const DEFAULT_MODEL = 'gpt-5-nano';

export function resolveModel(env: OpenAiEnvSchema): LanguageModel {
  const provider = createOpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL,
  });
  const modelId = env.OPENAI_MODEL ?? DEFAULT_MODEL;

  return provider(modelId);
}
