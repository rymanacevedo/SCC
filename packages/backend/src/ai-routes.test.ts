import { describe, expect, spyOn, test } from 'bun:test';
import type { Env } from 'hono';
import { createMockModel } from '../test/mock-model';
import * as modelAdapter from './services/model';

const env = {
  ALLOWED_ORIGIN: 'https://example.com',
  ALLOWED_COUNTRIES: 'US',
  GITHUB_REPO: 'acme/scc',
  GITHUB_TOKEN: 'token-123',
  OPENAI_API_KEY: 'openai-123',
};

type AppRequest = (
  input: Request | string,
  requestInit?: RequestInit,
  env?: Env['Bindings'] | {},
  executionCtx?: ExecutionContext,
) => Response | Promise<Response>;

function requestFromUs(
  app: { request: AppRequest },
  input: string,
  init?: RequestInit,
  requestEnv: Record<string, string> = env,
) {
  const request = new Request(`http://localhost${input}`, init);
  Object.defineProperty(request, 'cf', { value: { country: 'US' } });

  return app.request(request, undefined, requestEnv);
}

describe('AI routes', () => {
  const summaries = [{ title: 'Engineer', text: 'Builds reliable systems.' }];
  const suggestions = {
    expertRecommended: ['Problem solving'],
    other: ['Communication'],
  };

  for (const { route, output, responseBody } of [
    { route: 'summaries', output: { summaries }, responseBody: summaries },
    { route: 'skills', output: suggestions, responseBody: suggestions },
    { route: 'experience', output: suggestions, responseBody: suggestions },
  ]) {
    test(`POST /api/${route} preserves generated JSON with a V4 mock model`, async () => {
      const model = createMockModel(output);
      const resolveModel = spyOn(modelAdapter, 'resolveModel').mockReturnValue(
        model,
      );

      try {
        const { default: app } = await import('./index');
        const response = await requestFromUs(app, `/api/${route}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: env.ALLOWED_ORIGIN,
          },
          body: JSON.stringify({
            prompt: '<job><jobTitle>Engineer</jobTitle></job>',
          }),
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual(responseBody);
        expect(model.doGenerateCalls).toHaveLength(1);
      } finally {
        resolveModel.mockRestore();
      }
    });
  }

  test('returns 400 for invalid generation payloads', async () => {
    const { default: app } = await import('./index');

    const response = await requestFromUs(app, '/api/summaries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://example.com',
      },
      body: JSON.stringify({ prompt: '' }),
    });

    expect(response.status).toBe(400);
  });

  test('returns the normalized failure body when OpenAI env validation fails', async () => {
    const { default: app } = await import('./index');

    const response = await requestFromUs(
      app,
      '/api/experience',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://example.com',
        },
        body: JSON.stringify({
          prompt: '<job><jobTitle>Engineer</jobTitle></job>',
        }),
      },
      {
        ALLOWED_ORIGIN: env.ALLOWED_ORIGIN,
        ALLOWED_COUNTRIES: env.ALLOWED_COUNTRIES,
        GITHUB_REPO: env.GITHUB_REPO,
        GITHUB_TOKEN: env.GITHUB_TOKEN,
      },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to generate content',
    });
  });
});
