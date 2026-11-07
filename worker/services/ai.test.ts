import { afterEach, describe, expect, jest, test } from 'bun:test';
import { APICallError } from 'ai';
import { createMockJsonModel } from '../../test/mock-model.ts';
import { UpstreamTimeoutError } from '../lib/deadline.ts';
import { createExperience, createSkills, createSummaries } from './ai.ts';

afterEach(() => {
  jest.useRealTimers();
});

const prompt = '<job><jobTitle>Software Developer</jobTitle></job>';

describe('createSummaries', () => {
  test('returns schema-shaped output with an injected language model', async () => {
    const summaries = [
      {
        title: 'Software Developer',
        text: 'Builds reliable web applications with measurable results.',
      },
    ];
    const model = createMockJsonModel({ summaries });

    const result = await createSummaries(prompt, model);

    expect(result).toEqual(summaries);
  });
});

const sectionGenerators = [
  ['createSummaries', createSummaries, { summaries: [] }, 6000],
  ['createSkills', createSkills, { expertRecommended: [], other: [] }, 3000],
  [
    'createExperience',
    createExperience,
    { expertRecommended: [], other: [] },
    4000,
  ],
] as const;

describe.each(sectionGenerators)(
  '%s upstream bounds',
  (_name, generate, output, maxOutputTokens) => {
    test('passes its output-token limit to the model', async () => {
      const model = createMockJsonModel(output);

      await generate(prompt, model);

      expect(model.doGenerateCalls[0]?.maxOutputTokens).toBe(maxOutputTokens);
    });

    test('retries a retryable provider failure once, then gives up', async () => {
      const model = createMockJsonModel(output);
      let attempts = 0;
      model.doGenerate = async () => {
        attempts += 1;
        throw new APICallError({
          message: 'overloaded',
          url: 'https://provider.example',
          requestBodyValues: {},
          statusCode: 503,
          isRetryable: true,
        });
      };

      await expect(generate(prompt, model)).rejects.toBeDefined();

      expect(attempts).toBe(2);
    });

    test('a model that never answers is aborted at the 45s deadline', async () => {
      jest.useFakeTimers();
      const model = createMockJsonModel(output);
      let providerSignal: AbortSignal | undefined;
      // Never settles and ignores the signal: the worst-behaved upstream.
      model.doGenerate = ({ abortSignal }) => {
        providerSignal = abortSignal;
        return new Promise(() => {});
      };
      let settled = false;
      const result = generate(prompt, model).finally(() => {
        settled = true;
      });
      result.catch(() => {});

      jest.advanceTimersByTime(44_999);
      await Promise.resolve();
      expect(settled).toBe(false);
      jest.advanceTimersByTime(1);

      const error = await result.catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(UpstreamTimeoutError);
      expect(error).toMatchObject({ upstream: 'provider', timeoutMs: 45_000 });
      expect(providerSignal?.aborted).toBe(true);
    });
  },
);
