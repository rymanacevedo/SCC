import { REPORT_ASSETS_FILE } from '../shared/reportAssets.ts';
import { KNOWN_TEST_ASSETS } from './sensitive-reports.ts';

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
