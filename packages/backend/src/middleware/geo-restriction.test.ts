import { afterEach, describe, expect, mock, test } from 'bun:test';
import { Hono } from 'hono';
import {
  EnvironmentValidationError,
  validateGeoEnvironment,
} from '../../lib/environment';
import { createGeoRestrictionMiddleware } from './geo-restriction';

// biome-ignore lint/suspicious/noConsole: Tests restore the middleware's block logging after each mock.
const originalConsoleLog = console.log;

afterEach(() => {
  mock.restore();
  console.log = originalConsoleLog;
});

function createTestApp(allowedCountries: string[]) {
  const app = new Hono();
  app.use('*', createGeoRestrictionMiddleware({ allowedCountries }));
  app.post('/stub', (c) => c.json({ ok: true }));
  return app;
}

function requestWithCountry(country?: string) {
  const request = new Request('http://localhost/stub', { method: 'POST' });
  Object.defineProperty(request, 'cf', {
    value: country === undefined ? {} : { country },
  });

  return request;
}

describe('createGeoRestrictionMiddleware', () => {
  test('allows requests from countries in the allowlist', async () => {
    const app = createTestApp(['US']);

    const response = await app.request(requestWithCountry('US'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  test('blocks requests from countries outside the allowlist', async () => {
    const consoleLogMock = mock((_payload: unknown) => {});
    console.log = consoleLogMock as typeof console.log;
    const app = createTestApp(['US']);

    const response = await app.request(requestWithCountry('CA'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Access denied: region not supported',
    });
  });

  test('blocks requests with no country metadata', async () => {
    const consoleLogMock = mock((_payload: unknown) => {});
    console.log = consoleLogMock as typeof console.log;
    const app = createTestApp(['US']);

    const response = await app.request(requestWithCountry());

    expect(response.status).toBe(403);
  });

  test('blocks Cloudflare unknown-country requests', async () => {
    const consoleLogMock = mock((_payload: unknown) => {});
    console.log = consoleLogMock as typeof console.log;
    const app = createTestApp(['US']);

    const response = await app.request(requestWithCountry('XX'));

    expect(response.status).toBe(403);
  });

  test('allows all configured countries in a multi-country allowlist', async () => {
    const app = createTestApp(['US', 'CA']);

    const usResponse = await app.request(requestWithCountry('US'));
    const caResponse = await app.request(requestWithCountry('CA'));

    expect(usResponse.status).toBe(200);
    expect(caResponse.status).toBe(200);
  });

  test('logs blocked requests with country, path, method, and timestamp', async () => {
    const consoleLogMock = mock((_payload: unknown) => {});
    console.log = consoleLogMock as typeof console.log;
    const app = createTestApp(['US']);

    await app.request(requestWithCountry('GB'));

    const loggedObject = consoleLogMock.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;

    expect(consoleLogMock).toHaveBeenCalledTimes(1);
    expect(loggedObject).toMatchObject({
      event: 'geo_blocked',
      country: 'GB',
      path: '/stub',
      method: 'POST',
    });
    expect(typeof loggedObject?.timestamp).toBe('string');
  });

  test('normalizes allowlist whitespace and casing variants', async () => {
    const app = createTestApp([' us ', ' ca']);

    const usResponse = await app.request(requestWithCountry('US'));
    const caResponse = await app.request(requestWithCountry('CA'));

    expect(usResponse.status).toBe(200);
    expect(caResponse.status).toBe(200);
  });
});

describe('validateGeoEnvironment', () => {
  test('parses comma-separated country codes', () => {
    expect(
      validateGeoEnvironment({ ALLOWED_COUNTRIES: 'us, CA' }).allowedCountries,
    ).toEqual(['US', 'CA']);
  });

  test('rejects invalid country codes', () => {
    expect(() => validateGeoEnvironment({ ALLOWED_COUNTRIES: 'USA' })).toThrow(
      EnvironmentValidationError,
    );
  });
});
