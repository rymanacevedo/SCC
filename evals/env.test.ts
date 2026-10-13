import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEvalEnvironment, readEvalEnvironment } from './env.ts';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true })),
  );
});

describe('loadEvalEnvironment', () => {
  test('loads OpenAI and Gemini keys from the backend local secrets file', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'scc-eval-env-'));
    tempDirs.push(tempDir);

    await writeFile(
      join(tempDir, '.dev.vars'),
      ['OPENAI_API_KEY=openai-test', 'GEMINI_API_KEY=gemini-test'].join('\n'),
    );

    const env = await loadEvalEnvironment(tempDir);

    expect(env).toEqual({
      OPENAI_API_KEY: 'openai-test',
      GEMINI_API_KEY: 'gemini-test',
    });
  });

  test('reads the eval environment from process-style variables', () => {
    const env = readEvalEnvironment({
      OPENAI_API_KEY: 'openai-test',
      GEMINI_API_KEY: 'gemini-test',
      UNUSED_KEY: 'ignored',
    });

    expect(env).toEqual({
      OPENAI_API_KEY: 'openai-test',
      GEMINI_API_KEY: 'gemini-test',
    });
  });
});
