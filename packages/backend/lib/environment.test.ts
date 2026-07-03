import { describe, expect, test } from 'bun:test';
import { validateEnvironment, validateOpenAiEnvironment } from './environment';

describe('environment validation', () => {
  test('does not surface GEMINI_API_KEY in the production openai scope', () => {
    const env = validateOpenAiEnvironment({
      OPENAI_API_KEY: 'openai-test',
      GEMINI_API_KEY: 'gemini-test',
    });

    expect(env).toEqual({
      OPENAI_API_KEY: 'openai-test',
    });
  });

  test('does not surface GEMINI_API_KEY in the full production environment', () => {
    const env = validateEnvironment({
      ALLOWED_ORIGIN: 'https://example.com',
      ALLOWED_COUNTRIES: 'US',
      GITHUB_REPO: 'acme/scc',
      GITHUB_TOKEN: 'github-test',
      OPENAI_API_KEY: 'openai-test',
      GEMINI_API_KEY: 'gemini-test',
    });

    expect(env).toEqual({
      ALLOWED_ORIGIN: 'https://example.com',
      ALLOWED_COUNTRIES: 'US',
      GITHUB_REPO: 'acme/scc',
      GITHUB_TOKEN: 'github-test',
      OPENAI_API_KEY: 'openai-test',
    });
  });
});
