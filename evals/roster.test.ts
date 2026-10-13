import { describe, expect, test } from 'bun:test';
import { buildEvalName, modelRoster } from './roster.ts';

describe('modelRoster', () => {
  test('contains the fixed bake-off models in one place', () => {
    expect(modelRoster.map((entry) => entry.modelId)).toEqual([
      'gpt-5-nano',
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
    ]);
  });

  test('builds eval row names as section plus model', () => {
    expect(buildEvalName('Summaries', 'gemini-2.5-flash-lite')).toBe(
      'Summaries — gemini-2.5-flash-lite',
    );
  });
});
