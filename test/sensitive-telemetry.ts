import { expect } from 'bun:test';

/** Values that must never reach a GitHub issue body or a Workers Logs line. */
export const SENSITIVE_VALUES = [
  'jane.doe@example.com',
  '(555) 123-4567',
  'token=abc123',
  'abc123',
  '#fragment',
  'eyJhbGciOiJIUzI1NiJ9.secret',
  's3cr3t-api-key',
] as const;

export const SENSITIVE_URL =
  'https://scc.example/summary?token=abc123#fragment';

export const SENSITIVE_MESSAGE =
  'Save failed for jane.doe@example.com, call (555) 123-4567';

export const SENSITIVE_STACK = [
  'TypeError: Save failed',
  '    at saveSummary (https://scc.example/assets/main-abcdef12.js:12:34)',
  '    at fetchWithAuth (https://scc.example/assets/api-1a2b3c4d.js:5:6) Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.secret apiKey=s3cr3t-api-key',
].join('\n');

export const SENSITIVE_DESCRIPTION =
  'I typed jane.doe@example.com and (555) 123-4567, then it broke. My apiKey=s3cr3t-api-key';

export function expectNoSensitiveValues(output: string) {
  for (const value of SENSITIVE_VALUES) expect(output).not.toContain(value);
}
