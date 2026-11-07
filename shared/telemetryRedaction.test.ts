import { describe, expect, test } from 'bun:test';
import {
  REDACTED,
  redactTelemetryText,
  sanitizeTelemetryText,
  TRUNCATED,
  toPathOnlyUrl,
} from './telemetryRedaction.ts';

describe('toPathOnlyUrl', () => {
  test('keeps origin and path of an http(s) URL, nothing else', () => {
    expect(
      toPathOnlyUrl(
        'https://user:pw@scc.example:8443/info/step?token=abc123#fragment',
      ),
    ).toBe('https://scc.example:8443/info/step');
    expect(toPathOnlyUrl('http://scc.example')).toBe('http://scc.example/');
    expect(toPathOnlyUrl('https://scc.example/a(b)/[c]?q=(x)#y')).toBe(
      'https://scc.example/a(b)/[c]',
    );
  });

  test('anything that is not an http(s) URL becomes [redacted]', () => {
    for (const value of [
      '/info?email=a@b.co',
      'unknown',
      'www.example.com/x?ref=abc123',
      '//alice:hunter2@scc.example/x',
      'alice:hunter2@scc.example/x',
      'javascript:alert(1)',
      'mailto:jane@example.com',
      'blob:https://scc.example/uuid',
    ])
      expect(toPathOnlyUrl(value)).toBe(REDACTED);
  });

  test('a path segment that is not a plain name becomes [redacted]', () => {
    expect(
      toPathOnlyUrl(
        'https://scc.example/u/jane.doe@example.com/call/5551234567/x%20y/ok',
      ),
    ).toBe('https://scc.example/u/[redacted]/call/[redacted]/[redacted]/ok');
    expect(toPathOnlyUrl(`https://scc.example/${'a'.repeat(65)}`)).toBe(
      'https://scc.example/[redacted]',
    );
    expect(
      toPathOnlyUrl(
        'https://scc.example/node_modules/@scope/pkg/main-abc123.js',
      ),
    ).toBe('https://scc.example/node_modules/@scope/pkg/main-abc123.js');
  });
});

describe('redactTelemetryText keeps safe shapes', () => {
  test('ordinary error messages stay intact', () => {
    for (const message of [
      "Cannot read properties of undefined (reading 'name')",
      'Failed to fetch',
      'Unexpected token \'<\', "<!DOCTYPE "... is not valid JSON',
      'Request failed with status 502',
      'TypeError: x.y is not a function',
      'NetworkError when attempting to fetch resource.',
      "Can't find variable: foo_bar",
      'Load failed (status 404, after 3 retries).',
      'The operation was aborted.',
      'Résumé не сохранено — попробуйте ещё раз',
      'getElementById() returned null; e.g. a read-only field',
    ])
      expect(redactTelemetryText(message)).toBe(message);
  });

  test('an http(s) URL in text is emitted path-only', () => {
    expect(
      redactTelemetryText(
        'GET https://alice:pw@scc.example/a(b)?q=(private)#frag failed',
      ),
    ).toBe('GET https://scc.example/a(b) failed');
    expect(redactTelemetryText('see (https://scc.example/x?y=1).')).toBe(
      'see (https://scc.example/x).',
    );
  });
});

describe('redactTelemetryText replaces everything else', () => {
  test('unsafe shapes become one [redacted], keeping sentence punctuation', () => {
    const cases: [string, string][] = [
      ['mail jane.doe@example.com, then', 'mail [redacted], then'],
      ['call (555) 123-4567 now', 'call [redacted] now'],
      ['call 555 123 4567 now', 'call [redacted] now'],
      ['phone:555-123-4567', '[redacted]'],
      ['code 774411 sent', 'code [redacted] sent'],
      ['id 5551234567.', 'id [redacted].'],
      ['apiKey=s3cr3t and x', '[redacted] and x'],
      ['token hunter2 used', 'token [redacted] used'],
      ['on 2026-10-13 at 12:30:45', 'on [redacted] at [redacted]'],
      ['www.example.com/x?ref=abc123', '[redacted]'],
      ['GET api/x?ref=abc123 done', 'GET [redacted] done'],
      [
        '{"a":"https://x.example/a?q=1","b":"https://y.example/b?k=2","c":"https://z.example/c?s=3"}',
        '[redacted]',
      ],
      [`encoded ${'Zm9vYmFy'.repeat(4)}`, 'encoded [redacted]'],
      [`letters ${'abcdefghij'.repeat(5)}`, 'letters [redacted]'],
      ['jwt eyJhbGciOiJub25lIn0.eyJmIjoxfQ.ZmFrZQ', 'jwt [redacted]'],
      ['tel:+15551234567', '[redacted]'],
      ['ftp://u:p@x.example/a', '[redacted]'],
    ];
    for (const [input, expected] of cases)
      expect(redactTelemetryText(input)).toBe(expected);
  });

  test('the token after a credential word is always redacted', () => {
    const cases: [string, string][] = [
      ['Password hunter', 'Password [redacted]'],
      ['password: hunter', 'password: [redacted]'],
      ['PASSWD hunter', 'PASSWD [redacted]'],
      ['pass hunter', 'pass [redacted]'],
      ['secret santa', 'secret [redacted]'],
      ['the token expired', 'the token [redacted]'],
      ['Authorization: bearer abc', 'Authorization: [redacted]'],
      ['authorization: Basic dXNlcjpwYXNz', 'authorization: [redacted]'],
      ['Cookie: a=one; b=private', 'Cookie: [redacted]'],
      ['x-api-key: abc', 'x-api-key: [redacted]'],
      ['api_key abc', 'api_key [redacted]'],
      ['session abc', 'session [redacted]'],
      ['pin 4417', 'pin [redacted]'],
      ['otp: abcdef', 'otp: [redacted]'],
      ['passcode abc', 'passcode [redacted]'],
      ['passphrase correct', 'passphrase [redacted]'],
      ['passphrase=correct-horse', '[redacted]'],
      ['key: value', 'key: [redacted]'],
      [
        `password="${'first '.repeat(200)}private ending" next`,
        '[redacted] next',
      ],
      [
        `password: '${'first '.repeat(200)}private ending`,
        'password: [redacted]',
      ],
      ['secret "two words"\nnext line', 'secret [redacted]\nnext line'],
      ['token="unterminated value\nnext line', '[redacted]\nnext line'],
      [
        'Authorization: bearer short-secret\nCookie: a=one; b=private',
        'Authorization: [redacted]\nCookie: [redacted]',
      ],
      ['with apiKey=s3cr3t-api-key.\nMy page', 'with [redacted].\nMy page'],
      ['token short-secret then more', 'token [redacted] then more'],
      ['password : hunter', 'password : [redacted]'],
      ['password = hunter', 'password = [redacted]'],
      ['secret — hunter', 'secret — [redacted]'],
    ];
    for (const [input, expected] of cases)
      expect(redactTelemetryText(input)).toBe(expected);
    expect(redactTelemetryText("Unexpected token '<'")).toBe(
      "Unexpected token '<'",
    );
  });

  test('is linear: each adversarial input stays well inside its budget', () => {
    for (const input of [
      'a'.repeat(32_000),
      'a '.repeat(16_000),
      'password '.repeat(3_500),
      '('.repeat(32_000),
      `https://a.example/${'b/'.repeat(10_000)}`,
      '1 '.repeat(16_000),
      'é'.repeat(32_000),
    ]) {
      const started = performance.now();
      redactTelemetryText(input);
      expect(performance.now() - started).toBeLessThan(250);
    }
  });
});

describe('sanitizeTelemetryText', () => {
  test('leaves short safe text alone', () => {
    expect(sanitizeTelemetryText('Broken page for a@b.co', 100)).toBe(
      'Broken page for [redacted]',
    );
  });

  test('truncates over-long text to the limit with a visible marker', () => {
    const sanitized = sanitizeTelemetryText('word '.repeat(50), 10);
    expect(sanitized).toBe(`word word ${TRUNCATED}`);
  });

  test('redacts before the final cut, so a value straddling it is masked', () => {
    const sanitized = sanitizeTelemetryText(
      `${'a '.repeat(145)} jane.doe@example.com tail`,
      300,
    );
    expect(sanitized).not.toContain('jane');
    expect(sanitized.endsWith(TRUNCATED)).toBe(true);
  });

  test('drops the trailing partial token when the input was already cut', () => {
    expect(
      sanitizeTelemetryText('Bad credentials for hunter', 300, {
        inputWasCut: true,
      }),
    ).toBe(`Bad credentials for ${TRUNCATED}`);
  });
});
