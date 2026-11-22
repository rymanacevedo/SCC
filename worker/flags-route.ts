import { flagsBinding, readFlags } from './flags.ts';
import { apiError } from './lib/response.ts';

export async function handleFlagsRequest(
  request: Request,
  env: object,
): Promise<Response> {
  if (request.method !== 'GET') {
    return apiError(405, 'Method not allowed', undefined, { Allow: 'GET' });
  }
  const flags = await readFlags({ FLAGS: flagsBinding(env) });
  return Response.json({ flags }, { headers: { 'Cache-Control': 'no-store' } });
}
