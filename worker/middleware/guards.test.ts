import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import { createRouter, type Middleware } from 'remix/router';
import { generationRequestSchema } from '../../shared/schemas/generation.ts';
import { contractRequest } from '../../test/contract-request.ts';
import {
  bodyValidation,
  createGeoRestrictionMiddleware,
  createProfanityFilter,
  sameOriginGuard,
} from './guards.ts';

afterEach(() => mock.restore());
function throwawayRouter(middleware: Middleware[]) {
  const router = createRouter();
  router.post('/stub', {
    middleware,
    handler: () => Response.json({ ok: true }),
  });
  return router;
}

test('Same-origin guard accepts same-origin, same-site, none, and absent metadata; rejects cross-site and non-JSON', async () => {
  const router = throwawayRouter([sameOriginGuard]);
  for (const site of [undefined, 'same-origin', 'same-site', 'none']) {
    expect(
      (
        await router.fetch(
          contractRequest(
            '/stub',
            {},
            { headers: site ? { 'Sec-Fetch-Site': site } : {} },
          ),
        )
      ).status,
    ).toBe(200);
  }
  expect(
    (
      await router.fetch(
        contractRequest(
          '/stub',
          {},
          { headers: { 'Sec-Fetch-Site': 'cross-site' } },
        ),
      )
    ).status,
  ).toBe(403);
  for (const contentType of [
    'text/plain',
    'application/jsonp',
    'application/x-www-form-urlencoded',
    '',
  ]) {
    expect(
      (
        await router.fetch(
          contractRequest(
            '/stub',
            {},
            { headers: { 'Content-Type': contentType } },
          ),
        )
      ).status,
    ).toBe(415);
  }
});

test('geo restriction normalizes countries, fails closed even when XX is configured, and logs blocks', async () => {
  const log = spyOn(console, 'log').mockImplementation(() => {});
  const router = throwawayRouter([
    createGeoRestrictionMiddleware({ allowedCountries: [' us ', 'ca', 'XX'] }),
  ]);
  for (const country of ['US', ' us ', 'CA'])
    expect(
      (await router.fetch(contractRequest('/stub', {}, { country }))).status,
    ).toBe(200);
  for (const country of [null, 'XX', 'GB', '']) {
    const response = await router.fetch(
      contractRequest('/stub', {}, { country }),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'Access denied: region not supported',
    });
  }
  expect(log).toHaveBeenCalledWith(
    expect.objectContaining({
      event: 'geo_blocked',
      country: 'GB',
      path: '/stub',
      method: 'POST',
      timestamp: expect.any(String),
    }),
  );
});

test('Profanity filter passes clean prompts and refuses the unchanged word list, case-insensitively', async () => {
  const body = bodyValidation(generationRequestSchema);
  const router = throwawayRouter([
    body.middleware,
    createProfanityFilter(body.key),
  ]);
  const log = spyOn(console, 'log').mockImplementation(() => {});
  expect(
    (
      await router.fetch(
        contractRequest('/stub', { prompt: '<job>Software Developer</job>' }),
      )
    ).status,
  ).toBe(200);
  for (const term of [
    'SHIT',
    'Cam Model',
    'Adult Film',
    'OnlyFans',
    'Radicalizer',
    'Sex Worker',
  ]) {
    const response = await router.fetch(
      contractRequest('/stub', { prompt: `<job>${term}</job>` }),
    );
    expect(response.status).toBe(400);
    const envelope = (await response.json()) as {
      error: string;
      issues: unknown;
    };
    expect(envelope.error.toLowerCase()).toContain(term.toLowerCase());
    expect(envelope.issues).toEqual({ formErrors: [], fieldErrors: {} });
  }
  expect(log).toHaveBeenCalledWith(
    expect.objectContaining({ category: 'filtered' }),
  );
});
