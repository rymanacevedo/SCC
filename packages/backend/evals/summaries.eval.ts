import { evalite } from 'evalite';
import { wrapAISDKModel } from 'evalite/ai-sdk';
import { createSummaries } from '../src/services/ai';
import { readEvalEnvironment } from './env';
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

const summaryEvalData = summaryFixtures.map((fixture) => ({
  input: fixture,
}));

for (const rosterEntry of modelRoster) {
  evalite(buildEvalName('Summaries', rosterEntry.modelId), {
    data: summaryEvalData,
    task: async ({ prompt }) => {
      try {
        const environment = readEvalEnvironment(process.env);
        const model = wrapAISDKModel(rosterEntry.createModel(environment));

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
