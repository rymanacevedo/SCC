import { apiError } from './lib/response.ts';

export function createWorker(api: {
  fetch(request: Request): Promise<Response>;
}) {
  return {
    async fetch(request: Request) {
      try {
        return await api.fetch(request);
      } catch (error) {
        // The router rethrows the abort reason once the client disconnects. Nobody
        // reads this response, so log the cancellation without counting a failure.
        if (request.signal.aborted) {
          // oxlint-disable-next-line no-console -- Cancellations belong in Workers Logs.
          console.log({
            category: 'client_aborted',
            path: new URL(request.url).pathname,
          });
          return apiError(499, 'Client closed request');
        }
        // oxlint-disable-next-line no-console -- Worker failures belong in Workers Logs.
        console.error({
          category: 'unknown',
          message: 'router.fetch threw',
          error,
        });
        return apiError(500, 'Internal error');
      }
    },
  } satisfies ExportedHandler<Env>;
}
