import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { EvalEnvironment } from './env';

type OpenAiBakeOffModelId = 'gpt-5-nano';

type GeminiBakeOffModelId = 'gemini-2.5-flash-lite' | 'gemini-2.5-flash';

export type BakeOffModelId = OpenAiBakeOffModelId | GeminiBakeOffModelId;

type ModelFactory = (environment: EvalEnvironment) => LanguageModel;

export type ModelRosterEntry = {
  modelId: BakeOffModelId;
  createModel: ModelFactory;
};

const createOpenAiModel = (modelId: OpenAiBakeOffModelId): ModelFactory => {
  return (environment) =>
    createOpenAI({
      apiKey: environment.OPENAI_API_KEY,
    })(modelId);
};

const createGeminiModel = (modelId: GeminiBakeOffModelId): ModelFactory => {
  return (environment) =>
    createGoogleGenerativeAI({
      apiKey: environment.GEMINI_API_KEY,
    })(modelId);
};

export const modelRoster: ModelRosterEntry[] = [
  {
    modelId: 'gpt-5-nano',
    createModel: createOpenAiModel('gpt-5-nano'),
  },
  {
    modelId: 'gemini-2.5-flash-lite',
    createModel: createGeminiModel('gemini-2.5-flash-lite'),
  },
  {
    modelId: 'gemini-2.5-flash',
    createModel: createGeminiModel('gemini-2.5-flash'),
  },
];

export function buildEvalName(section: string, modelId: BakeOffModelId) {
  return `${section} — ${modelId}`;
}
