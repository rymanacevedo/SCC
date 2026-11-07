import { describe, expect, test } from 'bun:test';
import {
  redactTelemetryText,
  sanitizeTelemetryText,
  TRUNCATED,
  toPathOnlyUrl,
} from './telemetryRedaction.ts';

describe('toPathOnlyUrl', () => {
  test('keeps origin and path, drops query, fragment and credentials', () => {
    expect(
      toPathOnlyUrl(
        'https://user:pw@scc.example/info/step?token=abc123#fragment',
      ),
    ).toBe('https://scc.example/info/step');
  });
  test('cuts relative and unparseable values at the query or fragment', () => {
    expect(toPathOnlyUrl('/info?email=a@b.co#top')).toBe('/info');
    expect(toPathOnlyUrl('unknown')).toBe('unknown');
  });
});

describe('redactTelemetryText', () => {
  const sensitive = [
    'jane.doe+cv@example.com',
    '(555) 123-4567',
    '+44 20 7946 0958',
    'abc123',
    'fragment',
    'eyJhbGciOiJIUzI1NiJ9.payload',
    's3cr3t-value',
    'hunter2',
    'FAKE0not0a0real0secret0value0000000042',
    'deadbeefdeadbeefdeadbeefdeadbeef01',
  ];
  const text = [
    'Request for jane.doe+cv@example.com failed',
    'Call (555) 123-4567 or +44 20 7946 0958',
    'GET https://scc.example/api/x?token=abc123#fragment',
    'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload',
    'TypeError: apiKey=s3cr3t-value password: "hunter2"',
    'token FAKE0not0a0real0secret0value0000000042',
    'hash deadbeefdeadbeefdeadbeefdeadbeef01',
  ].join('\n');

  test('masks emails, phones, query strings, bearer tokens, secrets and key=value pairs', () => {
    const redacted = redactTelemetryText(text);
    for (const value of sensitive) expect(redacted).not.toContain(value);
    expect(redacted).toContain('[redacted]');
    expect(redacted).toContain('GET https://scc.example/api/x');
  });

  test('keeps ordinary messages and stack frames readable', () => {
    const stack = [
      "TypeError: Cannot read properties of undefined (reading 'key')",
      '    at authenticateUser (https://scc.example/assets/main-abcdef12.js:12:34)',
      '    at handleKeyDown@https://scc.example/assets/hotkeys-1a2b3c4d.js:1:2',
      '    at https://scc.example/assets/index.js?v=1a2b:56:78',
    ].join('\n');
    expect(redactTelemetryText(stack)).toBe(
      [
        "TypeError: Cannot read properties of undefined (reading 'key')",
        '    at authenticateUser (https://scc.example/assets/main-abcdef12.js:12:34)',
        '    at handleKeyDown@https://scc.example/assets/hotkeys-1a2b3c4d.js:1:2',
        '    at https://scc.example/assets/index.js:56:78',
      ].join('\n'),
    );
  });

  test('is idempotent', () => {
    const once = redactTelemetryText(text);
    expect(redactTelemetryText(once)).toBe(once);
  });
});

describe('sanitizeTelemetryText', () => {
  test('leaves short text alone apart from redaction', () => {
    expect(sanitizeTelemetryText('Broken page for a@b.co', 100)).toBe(
      'Broken page for [redacted]',
    );
  });

  test('truncates over-long text to the limit with a visible marker', () => {
    const sanitized = sanitizeTelemetryText('x'.repeat(50), 10);
    expect(sanitized).toBe(`${'x'.repeat(10)}${TRUNCATED}`);
    expect(sanitizeTelemetryText(sanitized, 10)).toBe(sanitized);
  });

  test('never keeps part of a secret cut off by the size bound', () => {
    const sanitized = sanitizeTelemetryText(
      `${'word '.repeat(40)}jane.doe@example.com`,
      50,
    );
    expect(sanitized).not.toContain('jane');
    expect(sanitized.endsWith(TRUNCATED)).toBe(true);
    // Redacting the tokens shrinks the text, pulling the email that straddles
    // the 4x input bound into the kept window.
    const shrinking = `${`${'A1'.repeat(30)} `.repeat(3)}jane.doe@example.com tail`;
    expect(sanitizeTelemetryText(shrinking, 50)).not.toContain('jane');
  });
});
