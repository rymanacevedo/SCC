import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { OpenAiEnvSchema } from '../lib/environment.ts';

export const DEFAULT_MODEL = 'gpt-5-nano' as const;

export function resolveModel({
  OPENAI_API_KEY,
  OPENAI_BASE_URL,
  OPENAI_MODEL,
}: OpenAiEnvSchema): LanguageModel {
  const openai = createOpenAI({
    apiKey: OPENAI_API_KEY,
    baseURL: OPENAI_BASE_URL,
  });

  return openai(OPENAI_MODEL ?? DEFAULT_MODEL);
}
