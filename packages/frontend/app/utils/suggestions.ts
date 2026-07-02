import { VITE_HONO_BACKEND_URL } from '../lib/environment';

/**
 * Proxies a suggestions prompt to a backend AI endpoint.
 *
 * Suggestions are decorative: the builder pages fire these requests
 * automatically and must keep working when generation fails (large multi-job
 * prompts, upstream outages, rate limits). A thrown error here unmounts the
 * calling page into its ErrorBoundary and blocks the user from progressing
 * (issue #160), so every failure mode degrades to an `{ error }` payload
 * instead of throwing.
 */
export async function proxySuggestions(
  backendPath: string,
  prompt: string,
): Promise<Response> {
  try {
    const res = await fetch(`${VITE_HONO_BACKEND_URL}${backendPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) {
      console.error(
        `Suggestions request to ${backendPath} failed with status ${res.status}.`,
      );
      return Response.json({ error: 'Suggestions are unavailable.' });
    }
    return Response.json(await res.json());
  } catch (error) {
    console.error(`Suggestions request to ${backendPath} failed.`, error);
    return Response.json({ error: 'Suggestions are unavailable.' });
  }
}
