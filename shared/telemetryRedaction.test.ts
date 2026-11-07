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

  test('masks secret shapes that are not simple word runs', () => {
    // Synthetic key shapes are assembled at runtime so no credential-shaped
    // literal sits in the source.
    const jwt = ['eyJhbGciOiJub25lIn0', 'eyJmYWtlIjoxfQ', 'ZmFrZQ'].join('.');
    const prefixedKey = ['sk', 'test', 'Fake0Not0Real0Value'].join('-');
    const accessKey = `${'AK'}${'IA'}${'Z'.repeat(16)}`;
    const cases: [string, string][] = [
      ['base64 aGVsbG8+d29ybGQ/Zm9vYmFyYmF6cXV4cXV1eDEyMzQ1Ng==', 'aGVsbG8'],
      [`jwt ${jwt}`, 'eyJ'],
      ['password="my secret pass" next', 'secret pass'],
      [`key ${prefixedKey}`, 'Fake0Not0Real'],
      [`aws ${accessKey}`, 'ZZZZ'],
      ['GET /api/x?email=x#a done', 'email'],
      ['HTTPS://X.COM/a?b=c done', 'b=c'],
      ['ws://x.com/a?sid=zz done', 'sid'],
      ['Call 07700 900123 or 555-1234', '900123'],
      ['Call 07700 900123 or 555-1234', '555-1234'],
    ];
    for (const [input, secret] of cases)
      expect(redactTelemetryText(input)).not.toContain(secret);
    expect(redactTelemetryText('GET /api/x?email=x#a done')).toBe(
      'GET /api/x done',
    );
    expect(redactTelemetryText('password="my secret pass" next')).toBe(
      'password="[redacted]" next',
    );
  });

  test('does not redact ordinary names that merely contain a keyword', () => {
    const text = 'author: John, keyboard: 3, monkey=banana, issue #12';
    expect(redactTelemetryText(text)).toBe(text);
    expect(redactTelemetryText('Cache key: foo, x: token=abc')).toBe(
      'Cache key: [redacted], x: token=[redacted]',
    );
  });

  test('stays fast on adversarial input', () => {
    const inputs = [
      'keyx'.repeat(8_000),
      'http://a'.repeat(4_000),
      'a@'.repeat(16_000),
      '+1'.repeat(16_000),
      `${'a'.repeat(31_999)}=`,
    ];
    const started = performance.now();
    for (const input of inputs) redactTelemetryText(input);
    expect(performance.now() - started).toBeLessThan(100);
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
