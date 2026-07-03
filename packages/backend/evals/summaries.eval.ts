import { evalite } from 'evalite';
import { wrapAISDKModel } from 'evalite/ai-sdk';
import { createSummaries } from '../src/services/ai';
import { summaryFixtures } from './fixtures/summaries';
import { buildEvalName, modelRoster } from './roster';

type SummariesEvalResult =
  | {
      status: 'ok';
      summaries: Awaited<ReturnType<typeof createSummaries>>;
    }
  | {
      status: 'error';
      error: string;
    };

for (const rosterEntry of modelRoster) {
  evalite(buildEvalName('Summaries', rosterEntry.modelId), {
    data: summaryFixtures.map((fixture) => ({
      input: fixture,
    })),
    task: async ({ prompt }) => {
      try {
        const model = wrapAISDKModel(
          rosterEntry.createModel({
            OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
            GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? '',
          }),
        );

        return {
          status: 'ok',
          summaries: await createSummaries(prompt, model),
        } satisfies SummariesEvalResult;
      } catch (error) {
        return {
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        } satisfies SummariesEvalResult;
      }
    },
    columns: async ({ input, output }) => [
      {
        label: 'Fixture',
        value: input.label,
      },
      {
        label: 'Status',
        value: output.status,
      },
    ],
  });
}
