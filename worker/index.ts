import { createApiRouter } from './router.ts';

const router = createApiRouter();

export function createWorker(api: Pick<typeof router, 'fetch'> = router) {
  return {
    async fetch(request: Request) {
      try {
        return await api.fetch(request);
      } catch (error) {
        console.error('router.fetch threw', error);
        return Response.json({ error: 'Internal error' }, { status: 500 });
      }
    },
  } satisfies ExportedHandler<Env>;
}

export default createWorker();
