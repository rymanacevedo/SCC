import { describe, expect, test } from 'bun:test';

const env = {
  ALLOWED_ORIGIN: 'https://example.com',
  ALLOWED_COUNTRIES: 'US',
  GITHUB_REPO: 'acme/scc',
  GITHUB_TOKEN: 'token-123',
  OPENAI_API_KEY: 'openai-123',
};

function requestFromUs(
  app: { request: (...args: any[]) => Response | Promise<Response> },
  input: string,
  init?: RequestInit,
  requestEnv: Record<string, string> = env,
) {
  const request = new Request(`http://localhost${input}`, init);
  Object.defineProperty(request, 'cf', { value: { country: 'US' } });

  return app.request(request, undefined, requestEnv);
}

describe('AI routes', () => {
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
