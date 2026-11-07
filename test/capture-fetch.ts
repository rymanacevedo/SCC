/**
 * Replaces `globalThis.fetch` with a stub that records each request body and
 * acknowledges it with `{ ok: true }`. The caller's afterEach restores fetch.
 */
export function captureFetchBodies(): string[] {
  const bodies: string[] = [];
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(String(init?.body));
    return Response.json({ ok: true });
  }) as unknown as typeof fetch;
  return bodies;
}
