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
  test('drops credentials from values URL cannot parse', () => {
    expect(toPathOnlyUrl('//alice:hunter2@scc.example/x?y=1')).toBe(
      '//scc.example/x',
    );
    expect(toPathOnlyUrl('alice:hunter2@scc.example/x')).toBe('scc.example/x');
  });
});

describe('redactTelemetryText: council round 1', () => {
  test('drops userinfo from URLs embedded in text', () => {
    for (const input of [
      'GET https://alice:hunter2@localhost/api?debug=true failed',
      'GET https://alice:hunter2@localhost/api failed',
      'proxy alice:hunter2@proxy.example:8080/x failed',
    ]) {
      const redacted = redactTelemetryText(input);
      expect(redacted).not.toContain('hunter2');
      expect(redacted).not.toContain('alice');
    }
    expect(
      redactTelemetryText('GET https://alice:hunter2@localhost/api?debug=true'),
    ).toBe('GET https://localhost/api');
  });

  test('masks a whole quoted value however long, terminated or not', () => {
    const words = `${'first '.repeat(200)}private ending`;
    for (const input of [
      `password="${words}" next`,
      `password='${words}' next`,
      `password="${words}`,
      `password="${'x'.repeat(511)} private ending" next`,
      `password="${'x'.repeat(513)} private ending" next`,
    ]) {
      const redacted = redactTelemetryText(input);
      expect(redacted).not.toContain('private');
      expect(redacted).not.toContain('first');
    }
    expect(redactTelemetryText(`password="${words}" next`)).toBe(
      'password="[redacted]" next',
    );
  });

  test('recognizes credential synonyms and the space-separated header form', () => {
    for (const input of [
      'passphrase=correct-horse',
      'passcode: 4417',
      'otp=774411',
      'verification_code=774411',
      'mfaCode: 774411',
      'pin=4417',
      'x-api-key 774411zz',
      'X-Auth-Token 774411zz',
      'apiKey 774411zz',
    ])
      expect(redactTelemetryText(input)).not.toMatch(/774411|4417|horse/);
    const ordinary =
      'author: John, keyboard: 3, error code: E42, the key is missing, token expired';
    expect(redactTelemetryText(ordinary)).toBe(ordinary);
    const frames = [
      '    at fetchWithAuth (https://scc.example/assets/api.js:5:6)',
      '    at Object.refreshToken [as refresh] (https://scc.example/a.js:1:2)',
    ].join('\n');
    expect(redactTelemetryText(frames)).toBe(frames);
  });

  test('strips the query and fragment of relative and schemeless URLs', () => {
    expect(redactTelemetryText('GET api/x?ref=abc123 done')).toBe(
      'GET api/x done',
    );
    expect(redactTelemetryText('see www.example.com/x?ref=abc123#top')).toBe(
      'see www.example.com/x',
    );
    expect(
      redactTelemetryText('    at load (assets/index.js?v=1a2b:56:78)'),
    ).toBe('    at load (assets/index.js:56:78)');
    const prose = 'What? Really?! See issue #12 in C# or e.g.?';
    expect(redactTelemetryText(prose)).toBe(prose);
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
      `password="${'a\\"'.repeat(10_000)}`,
      'x-api-key '.repeat(3_000),
      'a://b@'.repeat(5_000),
      'u:p@'.repeat(8_000),
      'www.a/?'.repeat(4_000),
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
  test('redacts before the final cut, so a secret straddling it is masked', () => {
    const value = `${'a'.repeat(290)} jane.doe@example.com tail`;
    const sanitized = sanitizeTelemetryText(value, 300);
    expect(sanitized).not.toContain('jane');
    expect(sanitized.endsWith(TRUNCATED)).toBe(true);
  });

  test('drops an incomplete trailing token when the input was already cut', () => {
    const sanitized = sanitizeTelemetryText(
      'Bad credentials for jane.doe@exa',
      300,
      {
        inputWasCut: true,
      },
    );
    expect(sanitized).toBe(`Bad credentials for ${TRUNCATED}`);
  });

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
