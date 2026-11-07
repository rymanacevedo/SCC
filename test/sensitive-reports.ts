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
  'alice',
  'hunter2',
  'debug=true',
  'short-secret',
  'private-value',
  'Tr0ub4dor',
] as const;

/** A page URL with userinfo, a query and a fragment. */
export const SENSITIVE_URL =
  'https://alice:hunter2@scc.example/summary?token=abc123#fragment';

/** A URL with userinfo and a query, embedded in free text. */
export const SENSITIVE_EMBEDDED_URL =
  'https://alice:hunter2@localhost/api?debug=true';

export const SENSITIVE_MESSAGE =
  'Save failed for jane.doe@example.com, call (555) 123-4567';

export const SENSITIVE_STACK = [
  'TypeError: Save failed',
  '    at saveSummary (https://scc.example/assets/main-abcdef12.js:12:34)',
  `    at fetchWithAuth (https://scc.example/assets/api-1a2b3c4d.js:5:6) GET ${SENSITIVE_EMBEDDED_URL} Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.secret apiKey=s3cr3t-api-key`,
  '    request headers: authorization=basic short-secret',
  '    Cookie: theme=dark; sid=private-value',
  '    at retry (https://scc.example/assets/api-1a2b3c4d.js:9:9)',
].join('\n');

export const SENSITIVE_DESCRIPTION = `I typed jane.doe@example.com and (555) 123-4567, then it broke. It called ${SENSITIVE_EMBEDDED_URL} with my apiKey=s3cr3t-api-key. My Password Tr0ub4dor&3 stopped working.`;

export function expectNoSensitiveValues(output: string) {
  for (const value of SENSITIVE_VALUES) expect(output).not.toContain(value);
}
