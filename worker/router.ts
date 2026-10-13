import { createRouter } from 'remix/router';

// The API routes are added by the API migration ticket. Keep the HTTP seam
// independent of Cloudflare bindings so Contract tests can call it directly.
export function createApiRouter() {
  return createRouter({
    defaultHandler() {
      return Response.json({ error: 'Not found' }, { status: 404 });
    },
  });
}
