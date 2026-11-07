import { describe, expect, test } from 'bun:test';
import {
  omittedText,
  REDACTED,
  REDACTED_ORIGIN,
  sanitizeErrorName,
  TRUNCATED,
  toPathOnlyUrl,
  truncateWithMarker,
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

  test('an origin that cannot be kept becomes the placeholder; the path stays', () => {
    expect(toPathOnlyUrl('http://127.0.0.1:5173/info?x=1')).toBe(
      `${REDACTED_ORIGIN}/info`,
    );
    expect(toPathOnlyUrl('https://555-123-4567.example/x')).toBe(
      `${REDACTED_ORIGIN}/x`,
    );
    for (const value of [
      '/info?email=a@b.co',
      'unknown',
      'www.example.com/x?ref=abc123',
      '//alice:hunter2@scc.example/x',
      'javascript:alert(1)',
      'mailto:jane@example.com',
      'about:blank',
    ])
      expect(toPathOnlyUrl(value)).toBe(`${REDACTED_ORIGIN}/`);
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

  test('a path segment must be a word, short number, version or hashed file name', () => {
    for (const path of [
      '/api/v1/users/me',
      '/assets/index-C4kL9x.js',
      '/assets/main-abcdef12.js.map',
      '/node_modules/@scope/pkg/error-reporting.test.ts',
      '/w/Foo_(bar)/[slug]/(group)/page',
      '/orders/1234/items',
    ])
      expect(toPathOnlyUrl(`https://scc.example${path}`)).toBe(
        `https://scc.example${path}`,
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
    ])
      expect(toPathOnlyUrl(`https://scc.example${path}`)).toBe(
        `https://scc.example${expected}`,
      );
  });
});

describe('free text is reduced to its length', () => {
  test('omittedText names the field and keeps only the length', () => {
    expect(omittedText('description', 'Email me at jane@example.com')).toBe(
      '[description omitted: 28 characters]',
    );
    expect(omittedText('message', '')).toBe('[message omitted: 0 characters]');
  });
});

describe('sanitizeErrorName', () => {
  test('keeps an error class name', () => {
    for (const name of [
      'Error',
      'TypeError',
      'ChunkLoadError',
      'DOMException',
      'AI_APICallError',
      'GitHubIssueCreationError',
    ])
      expect(sanitizeErrorName(name)).toBe(name);
  });

  test('anything else becomes [redacted]', () => {
    for (const name of [
      'hunter2',
      'correcthorse',
      'TokenError: correcthorse',
      'apiKey',
      'Error5551234567',
      'jane@example.com',
      '',
    ])
      expect(sanitizeErrorName(name)).toBe(REDACTED);
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
