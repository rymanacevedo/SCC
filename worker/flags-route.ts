// The one route exposing the resolved flag set: GET /api/flags returns
// {"flags": {...}} with every known flag. Register it in the Worker's API
// router; it needs no request body and reveals nothing beyond the flag names.
import { readFlags } from './flags.ts';
import { apiError } from './lib/response.ts';

export const FLAGS_ROUTE = '/api/flags';

export async function handleFlagsRequest(
  request: Request,
  env: object,
): Promise<Response> {
  if (request.method !== 'GET') {
    return apiError(405, 'Method not allowed', undefined, { Allow: 'GET' });
  }
  const flags = await readFlags(env);
  return Response.json({ flags }, { headers: { 'Cache-Control': 'no-store' } });
}
