import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from 'bun:test';
import { reportError } from './reportError';

// Polyfill window.location for bun test environment
beforeAll(() => {
  if (typeof window === 'undefined') {
    // @ts-expect-error -- polyfilling globals for test
    globalThis.window = {
      location: { href: 'http://localhost:3000/experience' },
    };
  }
});

describe('reportError', () => {
  const originalFetch = globalThis.fetch;
  let mockFetch: ReturnType<typeof mock>;

  beforeEach(() => {
    mockFetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ success: true }))),
    );
    globalThis.fetch = mockFetch as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('sends telemetry to /api/errors with POST', () => {
    reportError(new Error('test error'));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/errors');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  test('includes timestamp, url, message, and stackTrace for Error instances', () => {
    const error = new Error('Something broke');
    reportError(error);

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body.url).toBe('http://localhost:3000/experience');
    expect(body.message).toBe('Something broke');
    expect(body.stackTrace).toContain('Error: Something broke');
  });

  test('uses error.message for Error instances', () => {
    reportError(new Error('specific message'));

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.message).toBe('specific message');
  });

  test('uses String() for non-Error values', () => {
    reportError('string error');

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.message).toBe('string error');
    expect(body.stackTrace).toBe('');
  });

  test('converts number errors to string', () => {
    reportError(404);

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.message).toBe('404');
    expect(body.stackTrace).toBe('');
  });

  test('converts null to string', () => {
    reportError(null);

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.message).toBe('null');
    expect(body.stackTrace).toBe('');
  });

  test('converts undefined to string', () => {
    reportError(undefined);

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.message).toBe('undefined');
    expect(body.stackTrace).toBe('');
  });

  test('converts object to string', () => {
    reportError({ code: 500 });

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.message).toBe('[object Object]');
    expect(body.stackTrace).toBe('');
  });

  test('handles Error with no stack trace', () => {
    const error = new Error('no stack');
    error.stack = undefined;
    reportError(error);

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.message).toBe('no stack');
    expect(body.stackTrace).toBe('');
  });

  test('fails silently when fetch rejects', () => {
    globalThis.fetch = mock(() =>
      Promise.reject(new Error('Network failure')),
    ) as typeof fetch;

    // Should not throw
    expect(() => reportError(new Error('test'))).not.toThrow();
  });

  test('fails silently when fetch throws synchronously', () => {
    globalThis.fetch = mock(() => {
      throw new Error('Synchronous failure');
    }) as typeof fetch;

    // Should not throw
    expect(() => reportError(new Error('test'))).not.toThrow();
  });
});
