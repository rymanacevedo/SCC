import { apiError } from './lib/response.ts';

export function createWorker(api: {
  fetch(request: Request): Promise<Response>;
}) {
  return {
    async fetch(request: Request) {
      try {
        return await api.fetch(request);
      } catch (error) {
        // biome-ignore lint/suspicious/noConsole: Worker failures belong in Workers Logs.
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
