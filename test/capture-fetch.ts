import { REPORT_ASSETS_FILE } from '../shared/reportAssets.ts';
import { KNOWN_TEST_ASSETS } from './sensitive-reports.ts';

/**
 * Replaces `globalThis.fetch` with a stub that records each request body and
 * acknowledges it with `{ ok: true }`. A read of the published asset list is
 * answered with `KNOWN_TEST_ASSETS` and not recorded. The caller's afterEach
 * restores fetch.
 */
export function captureFetchBodies(): string[] {
  const bodies: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === `/${REPORT_ASSETS_FILE}`)
      return Response.json([...KNOWN_TEST_ASSETS]);
    bodies.push(String(init?.body));
    return Response.json({ ok: true });
  }) as unknown as typeof fetch;
  return bodies;
}
