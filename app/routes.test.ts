import { expect, mock, test } from 'bun:test';
import * as remixRoutes from 'remix/routes';
import { APP_ROUTE_PATTERNS } from '../shared/routes.ts';

// Records every pattern the app router and its controllers declare, then
// passes the call through, so the real router is what the test reads.
const declared = new Set<string>();
// Read before the mock: the mock updates this module's live bindings.
const { get, post } = remixRoutes;
function record<F>(method: F): F {
  const call = method as unknown as (...args: unknown[]) => unknown;
  return ((pattern: unknown, ...rest: unknown[]) => {
    declared.add(String(pattern));
    return call(pattern, ...rest);
  }) as unknown as F;
}
mock.module('remix/routes', () => ({
  ...remixRoutes,
  get: record(get),
  post: record(post),
}));

test('every page route the app router defines is on the shared route list', async () => {
  const { createAppRouter } = await import('./router.tsx');
  createAppRouter();
  expect([...declared].sort()).toEqual([...APP_ROUTE_PATTERNS].sort());
});
