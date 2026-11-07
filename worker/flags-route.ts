// The one route exposing the resolved flag set: GET /api/flags returns
// {"flags": {...}} with every known flag. Register it in the Worker's API
// router; it needs no request body and reveals nothing beyond the flag names.
import { type FlagsEnv, readFlags } from './flags.ts';

export const FLAGS_ROUTE = '/api/flags';

export async function handleFlagsRequest(
  request: Request,
  env: FlagsEnv,
): Promise<Response> {
  if (request.method !== 'GET') {
    return Response.json(
      { error: 'Method not allowed' },
      { status: 405, headers: { Allow: 'GET' } },
    );
  }
  const flags = await readFlags(env);
  return Response.json({ flags }, { headers: { 'Cache-Control': 'no-store' } });
}
