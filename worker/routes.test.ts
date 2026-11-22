import { expect, mock, test } from 'bun:test';
import * as remixRouter from 'remix/router';
import { API_ROUTE_PATTERNS } from '../shared/routes.ts';

const declared = new Set<string>();
const { createRouter } = remixRouter;
mock.module('remix/router', () => ({
  ...remixRouter,
  createRouter: (...args: Parameters<typeof createRouter>) => {
    const router = createRouter(...args);
    const route = router.route.bind(router) as (
      ...values: unknown[]
    ) => unknown;
    router.route = ((method: unknown, path: unknown, ...rest: unknown[]) => {
      declared.add(String(path));
      return route(method, path, ...rest);
    }) as typeof router.route;
    return router;
  },
}));

test('every API route the Worker router defines is on the shared route list', async () => {
  const { createApiRouter } = await import('./router.ts');
  createApiRouter({});
  expect([...declared].sort()).toEqual([...API_ROUTE_PATTERNS].sort());
});
