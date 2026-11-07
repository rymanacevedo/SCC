import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import {
  isSafeIdentifierPart,
  isSensitiveToken,
  omittedText,
  REPORT_ORIGIN,
  sanitizeErrorName,
  TRUNCATED,
  toPathOnlyUrl,
  truncateWithMarker,
} from './telemetryRedaction.ts';

// A key, assembled at runtime so none sits in source.
const KEY = ['sk', 'live', 'abcdefghijklmnopqrstuvwx'].join('_');

describe('toPathOnlyUrl', () => {
  test('keeps only the path of an http(s) URL, under the one synthetic origin', () => {
    expect(REPORT_ORIGIN).toBe('https://app.invalid');
    for (const [input, expected] of [
      [
        'https://user:pw@scc.example:8443/info/step?token=abc123#fragment',
        '/info/step',
      ],
      ['http://scc.example', '/'],
      ['https://scc.example/a(b)/[c]?q=(x)#y', '/a(b)/[c]'],
      ['http://127.0.0.1:5173/info?x=1', '/info'],
      ['https://janedoe.example/x', '/x'],
    ])
      expect(toPathOnlyUrl(input)).toBe(`${REPORT_ORIGIN}${expected}`);
  });

  test('anything that is not an http(s) URL is the synthetic origin alone', () => {
    for (const value of [
      '/info?email=a@b.co',
      'unknown',
      'www.example.com/x?ref=abc123',
      '//alice:hunter2@scc.example/x',
      'javascript:alert(1)',
      'mailto:jane@example.com',
      'about:blank',
    ])
      expect(toPathOnlyUrl(value)).toBe(`${REPORT_ORIGIN}/`);
  });

  test('the result is always a valid URL', () => {
    for (const value of [
      'http://127.0.0.1:5173/info',
      'about:blank',
      'not a url',
      'https://scc.example/u/jane@example.com',
    ])
      expect(() => new URL(toPathOnlyUrl(value))).not.toThrow();
  });

  test('a key-shaped segment is redacted however it is wrapped or suffixed', () => {
    for (const segment of [
      KEY,
      `(${KEY})`,
      `[${KEY}]`,
      `@${KEY}`,
      `${KEY}.js`,
      `${KEY}.js.map`,
      `x-${KEY}`,
      ['pk', 'test', 'abcdefghijklmnopqrstuvwx'].join('_'),
      ['ghp', 'abcdefghijklmnopqrstuvwxyzabcdefghij'].join('_'),
      ['xoxb', 'abcdefghijklmnopqrstuvwx'].join('-'),
    ])
      expect(toPathOnlyUrl(`https://scc.example/k/${segment}/a`)).toBe(
        `${REPORT_ORIGIN}/k/[redacted]/a`,
      );
  });

  test('a path segment must be a word, short number, version or hashed file name', () => {
    for (const path of [
      '/api/v1/users/me',
      '/assets/index-C4kL9x.js',
      '/assets/main-abcdef12.js.map',
      '/node_modules/@scope/pkg/error-reporting.test.ts',
      '/w/Foo_(bar)/[slug]/(group)/page',
      '/orders/1234/items',
      '/components/UserProfile.tsx',
      '/lib/getElementById.js',
      '/polyfills/XMLHttpRequest.js',
      '/api/user_settings/display_name',
      '/README.md',
    ])
      expect(toPathOnlyUrl(`https://scc.example${path}`)).toBe(
        `${REPORT_ORIGIN}${path}`,
      );
    for (const [path, expected] of [
      ['/reset/XkfQpLmZr9Ab', '/reset/[redacted]'],
      ['/invite/a1b2c3/accept', '/invite/[redacted]/accept'],
      ['/u/jane_doe2/x', '/u/[redacted]/x'],
      ['/u/jane.doe@example.com/x', '/u/[redacted]/x'],
      ['/call/555-123-4567', '/call/[redacted]'],
      ['/call/555.123.4567/x', '/call/[redacted]/x'],
      ['/u/1a2b3c4d5e', '/u/[redacted]'],
      ['/x%20y/ok', '/[redacted]/ok'],
      [`/${'a'.repeat(65)}`, '/[redacted]'],
      ['/assets/NotAHash9-12345678.js', '/assets/[redacted]'],
      // Key-shaped and mixed-case segments, built so no key sits in source.
      [
        `/k/${['sk', 'live', 'AbCdEfGhIjKlMnOpQrStUvWx'].join('_')}`,
        '/k/[redacted]',
      ],
      [
        `/k/${['pk', 'test', 'abcdefghijklmnopqrstuvwx'].join('_')}`,
        '/k/[redacted]',
      ],
      [
        `/k/${['ghp', 'abcdefghijklmnopqrstuvwxyzabcdefghij'].join('_')}`,
        '/k/[redacted]',
      ],
      [`/k/${['xoxb', 'abcdefghijklmnopqrstuvwx'].join('-')}`, '/k/[redacted]'],
      ['/reset/XkfQpLmZrAbWy', '/reset/[redacted]'],
    ])
      expect(toPathOnlyUrl(`https://scc.example${path}`)).toBe(
        `${REPORT_ORIGIN}${expected}`,
      );
  });
});

describe('isSensitiveToken', () => {
  test('finds a key shape anywhere, bounded by anything not a letter or digit', () => {
    for (const value of [
      KEY,
      `(${KEY})`,
      `@${KEY}`,
      `${KEY}.js`,
      `Object.${KEY}`,
      `x [as ${KEY}]`,
      `$${KEY}`,
    ])
      expect(isSensitiveToken(value)).toBe(true);
  });

  test('ordinary names and segments are not keys', () => {
    for (const value of [
      'saveSummary',
      'Object.<anonymous> [as run]',
      'node_modules',
      'error-reporting.test.ts',
      'index-C4kL9x.js',
      'getElementsByClassName',
      'user_settings',
      'api_v1',
    ])
      expect(isSensitiveToken(value)).toBe(false);
  });
});

describe('free text is reduced to its length', () => {
  test('omittedText names the field and keeps only the length', () => {
    expect(omittedText('description', 'Email me at jane@example.com')).toBe(
      '[description omitted: 28 characters]',
    );
    expect(omittedText('message', '')).toBe('[message omitted: 0 characters]');
  });

  test("a second pass keeps the first pass's placeholder, not its own length", () => {
    const once = omittedText('message', 'Save failed for jane.doe@example.com');
    expect(omittedText('message', once)).toBe(once);
    expect(once).toBe('[message omitted: 36 characters]');
    // A crafted placeholder cannot carry a number through.
    const crafted = '[message omitted: 5551234567 characters]';
    expect(omittedText('message', crafted)).toBe(
      '[message omitted: 40 characters]',
    );
  });
});

describe('sanitizeErrorName', () => {
  test('keeps a known error class name', () => {
    for (const name of [
      'Error',
      'TypeError',
      'RangeError',
      'SyntaxError',
      'AggregateError',
      'DOMException',
      'AbortError',
      'ChunkLoadError',
      'QuotaExceededError',
      'AI_APICallError',
      'AI_RetryError',
      'GitHubIssueCreationError',
      'UpstreamTimeoutError',
    ])
      expect(sanitizeErrorName(name)).toBe(name);
  });

  test('any other name becomes Error, however error-shaped', () => {
    for (const name of [
      `Token_${KEY}Error`,
      'MyCustomError',
      'TokenError',
      'hunter2',
      'TokenError: correcthorse',
      'jane@example.com',
      '',
    ])
      expect(sanitizeErrorName(name)).toBe('Error');
  });
});

describe('KNOWN_ERROR_NAMES stays in step with the code', () => {
  test('every Error class the app and Worker define is on the list', async () => {
    const repoRoot = join(import.meta.dir, '..');
    const classes: string[] = [];
    for (const file of new Bun.Glob(
      '{app,worker,shared}/**/*.{ts,tsx}',
    ).scanSync(repoRoot)) {
      if (/\.test\.tsx?$/.test(file)) continue;
      const source = await Bun.file(join(repoRoot, file)).text();
      for (const [, name] of source.matchAll(/class (\w+) extends Error\b/g))
        if (name) classes.push(name);
    }
    expect(classes.length).toBeGreaterThan(0);
    for (const name of classes) expect(sanitizeErrorName(name)).toBe(name);
  });
});

describe('isSafeIdentifierPart', () => {
  test('keeps real code names', () => {
    for (const part of [
      'renderSummary',
      'map',
      'anonymous',
      'loadUser',
      'Foo',
      'getElementById',
      'XMLHttpRequest',
      'node_modules',
      'README',
      'MAX_RETRY_COUNT',
      'v1',
      '1234',
    ])
      expect(isSafeIdentifierPart(part)).toBe(true);
  });

  test('random, key-shaped, digit-heavy or mixed letter-digit parts fail', () => {
    for (const part of [
      'XkfQpLmZr9Ab',
      'XkfQpLmZrAbW',
      ['AKIA', 'IOSFODNN7EXAMPLE'].join(''),
      'ABCDEFGHIJKLMNOPQR',
      KEY,
      KEY.toUpperCase(),
      'hunter2',
      'user5551234567',
    ])
      expect(isSafeIdentifierPart(part)).toBe(false);
  });
});

describe('truncateWithMarker', () => {
  test('cuts to the limit, visible marker included, without splitting a surrogate pair', () => {
    expect(truncateWithMarker('word '.repeat(50), 23)).toBe(
      `word word ${TRUNCATED}`,
    );
    // Ten code units fit before the marker; the emoji at 9-10 straddles it.
    const cut = truncateWithMarker(`${'a'.repeat(9)}${'😀'.repeat(10)}`, 23);
    expect(cut).toBe(`${'a'.repeat(9)}${TRUNCATED}`);
    expect(cut.isWellFormed()).toBe(true);
    expect(truncateWithMarker('short', 23)).toBe('short');
  });
});
