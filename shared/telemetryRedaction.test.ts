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

describe('redactTelemetryText: credential headers', () => {
  test('masks the whole value after any auth scheme, in any case', () => {
    const digest =
      'Digest username="u", nonce="n1", response="6629fae49393a05397450978507c4ef1"';
    const cases = [
      'Authorization: bearer short-secret',
      'Authorization: BEARER short-secret',
      'authorization=Bearer short-secret',
      'Authorization: basic dXNlcjpwYXNz',
      'Proxy-Authorization: Basic dXNlcjpwYXNz',
      'Authorization: token short-secret',
      `Authorization: ${digest}`,
      'auth: Negotiate short-secret',
      'x-auth: bearer short-secret',
      '"Authorization":"bearer short-secret"',
      "{ authorization: 'Basic dXNlcjpwYXNz' }",
    ];
    for (const input of cases) {
      const redacted = redactTelemetryText(`${input}\nnext line`);
      expect(redacted).not.toMatch(/short-secret|dXNlcjpwYXNz|6629fae|nonce/);
      expect(redacted.endsWith('\nnext line')).toBe(true);
    }
    expect(redactTelemetryText('Authorization: bearer short-secret')).toBe(
      'Authorization: [redacted]',
    );
  });

  test('masks the whole Cookie and Set-Cookie value to the end of the line', () => {
    const cases = [
      'Cookie: a=one; b=private-value',
      'cookie: a=one;b=private-value; c=more',
      'Cookie=a=one; b=private-value',
      'Set-Cookie: sid=private-value; Path=/; HttpOnly; Secure',
      'set-cookie: theme=dark; private-value=1',
      '"cookie":"a=one; b=private-value"',
    ];
    for (const input of cases) {
      const redacted = redactTelemetryText(`${input}\nGET /next`);
      expect(redacted).not.toMatch(/private-value|one|sid|theme/);
      expect(redacted.endsWith('\nGET /next')).toBe(true);
    }
    expect(redactTelemetryText('Cookie: a=one; b=private-value')).toBe(
      'Cookie: [redacted]',
    );
  });

  test('masks a secret-looking value after a single credential word and a space', () => {
    const cases: [string, string][] = [
      ['Password hunter2', 'hunter2'],
      ['Authorization abc123', 'abc123'],
      ['token s3cr3t-value done', 's3cr3t'],
      ['secret p@ss_w0rd!', 'p@ss'],
      ['pin 4417', '4417'],
      ['otp 774411', '774411'],
      ['key AbCdEfGhIjKlMnOpQr', 'AbCdEfGh'],
      ['api key zz99zz99', 'zz99'],
      ['bearer 0123456789abcdef', '0123456789'],
      ['secret Tr0ub4dor&3 next', '&3'],
      ["Password 'hunter2'", 'hunter2'],
      ['password: hunter', 'hunter'],
      ['token: abc123def', 'abc123'],
      ['Token abcdef123456', 'abcdef'],
    ];
    for (const [input, secret] of cases)
      expect(redactTelemetryText(input)).not.toContain(secret);
    expect(redactTelemetryText('Password hunter2')).toBe('Password [redacted]');
  });

  test('keeps prose, dates, paths and stack frames after a credential word', () => {
    const prose = [
      'the token expired',
      'key not found',
      'password is required',
      'Password must contain 8 characters',
      'session started 2026-10-13 12:00',
      'key 123 not found',
      'token v2 rejected',
      'token /api/session/refresh failed',
      'secret santa',
      'auth header missing',
      'cookie consent banner',
      'the bearer of bad news',
      'Bearer of the message',
      'Basic information is required',
      'Failed to refresh token: network error',
      'Invalid key: expected string',
      'session: expired',
      'Unexpected token \'<\', "<!DOCTYPE " is not valid JSON',
      'Unexpected token < in JSON at position 0',
      "TypeError: Cannot read properties of undefined (reading 'token')",
      '    at validateToken (https://scc.example/assets/auth.js:12:34)',
      '    at Object.password [as check] (https://scc.example/a.js:1:2)',
      '    at token.refresh (https://scc.example/a.js:1:2)',
    ];
    for (const line of prose) expect(redactTelemetryText(line)).toBe(line);
  });
});

describe('redactTelemetryText: URLs, quoted values and credential names', () => {
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

  test('drops a whole query that contains delimiters, up to the URL’s own closer', () => {
    const cases: [string, string][] = [
      [
        'GET https://scc.example/api?q=(private-value)&other=visible done',
        'GET https://scc.example/api done',
      ],
      [
        'GET https://scc.example/api?q=\'private-value\'&b="x"&c=`y` done',
        'GET https://scc.example/api done',
      ],
      [
        'GET https://scc.example/api?q=[private-value]<x>{y} done',
        'GET https://scc.example/api done',
      ],
      [
        '    at load (https://scc.example/a.js?q=(private-value):10:5)',
        '    at load (https://scc.example/a.js:10:5)',
      ],
      [
        '    at load (https://scc.example/a.js?q=((private-value)):10:5)\n    at next (x.js:1:2)',
        '    at load (https://scc.example/a.js:10:5)\n    at next (x.js:1:2)',
      ],
      [
        'see "https://scc.example/a?q=(private-value)" and more',
        'see "https://scc.example/a" and more',
      ],
      [
        "see 'https://scc.example/a#private-value(x)' and more",
        "see 'https://scc.example/a' and more",
      ],
      [
        'see [https://scc.example/a?q=[private-value]] and more',
        'see [https://scc.example/a] and more',
      ],
      [
        'see <https://scc.example/a?q=<private-value>> and more',
        'see <https://scc.example/a> and more',
      ],
      [
        'see `https://scc.example/a?q=private-value` and more',
        'see `https://scc.example/a` and more',
      ],
      ['GET /api/x?q=(private-value) done', 'GET /api/x done'],
    ];
    for (const [input, expected] of cases) {
      expect(redactTelemetryText(input)).toBe(expected);
      expect(redactTelemetryText(input)).not.toContain('private-value');
    }
  });

  test('keeps a path with parens, brackets, quotes or @ and still drops its query', () => {
    const cases: [string, string][] = [
      [
        'GET https://scc.example/a(b)?q=private-value#private-value done',
        'GET https://scc.example/a(b) done',
      ],
      [
        'GET https://scc.example/a(b?q=private-value done',
        'GET https://scc.example/a(b done',
      ],
      [
        'GET https://scc.example/a)b?q=private-value done',
        'GET https://scc.example/a)b done',
      ],
      [
        'GET https://scc.example/w/Foo_(bar)#private-value done',
        'GET https://scc.example/w/Foo_(bar) done',
      ],
      [
        "GET https://scc.example/a[1]/it's/@user?q=private-value done",
        "GET https://scc.example/a[1]/it's/@user done",
      ],
      ['GET /api/a(b)/c?q=private-value done', 'GET /api/a(b)/c done'],
      [
        'GET https://alice:hunter2@scc.example/a(b)?q=private-value done',
        'GET https://scc.example/a(b) done',
      ],
      [
        '    at load (https://scc.example/a(b).js?v=private-value:10:5)',
        '    at load (https://scc.example/a(b).js:10:5)',
      ],
      [
        '    at load (https://scc.example/a(b.js?v=(private-value):10:5)',
        '    at load (https://scc.example/a(b.js:10:5)',
      ],
      [
        'see (https://scc.example/a(b)?q=private-value) next',
        'see (https://scc.example/a(b)) next',
      ],
      [
        'see "https://scc.example/a(b)?q=private-value", next',
        'see "https://scc.example/a(b)", next',
      ],
      [
        '[link](https://scc.example/a(b)?q=(private-value)) next',
        '[link](https://scc.example/a(b)) next',
      ],
      [
        '{"url":"https://scc.example/a(b)?q=private-value"}',
        '{"url":"https://scc.example/a(b)"}',
      ],
      [
        'redirect=https://scc.example/a?next=https://x.example/b(c)?q=private-value',
        'redirect=https://scc.example/a',
      ],
    ];
    for (const [input, expected] of cases) {
      expect(redactTelemetryText(input)).toBe(expected);
      expect(redactTelemetryText(input)).not.toContain('private-value');
    }
  });
});

describe('redactTelemetryText: phone numbers after a colon', () => {
  test('masks a phone number after a label or a bare colon', () => {
    for (const input of [
      'phone:555-123-4567',
      'phone:5551234567',
      'tel:+15551234567',
      'mobile: (555) 123-4567',
      'cell=555.123.4567',
      'fax: 555 1234',
      'Phone 555 123 4567',
      'phoneNumber: 555-1234',
      'id:5551234567 failed',
      'id:5551234567:3 failed',
      'user:+44 20 7946 0958',
    ])
      expect(redactTelemetryText(input)).not.toMatch(/555|1234|7946|0958|4567/);
  });

  test('keeps stack coordinates, times, ports and dates readable', () => {
    const readable = [
      '    at a (https://scc.example/assets/main.js:5551234567:12)',
      '    at a (https://scc.example/assets/main.js:1:5551234567)',
      '    at main.js:12:34',
      '    at /home/app/src/main.ts:120:5',
      '    at <anonymous>:5551234567:1',
      '    at a (https://scc.example/a(b).js:1:5551234567)',
      'at 2026-10-13T12:00:00.000Z on localhost:8080',
      'cell count: 12, phone: n/a',
      'retry at 12:30:45',
    ];
    for (const line of readable) expect(redactTelemetryText(line)).toBe(line);
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
      'Cache key: foo, x: token=[redacted]',
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
      `token "${"token 'a ".repeat(3_500)}`,
      'Password '.repeat(3_500),
      'token: bearer '.repeat(2_000),
      'session: x '.repeat(3_000),
      'Bearer of '.repeat(3_000),
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
