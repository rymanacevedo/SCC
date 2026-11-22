import { env } from 'cloudflare:workers';
import { createApiRouter } from './router.ts';
import { createWorker } from './worker.ts';

let cachedEnv: Env | undefined;
let worker: ReturnType<typeof createWorker> | undefined;
export default {
  fetch(request: Request) {
    if (!worker || cachedEnv !== env) {
      cachedEnv = env;
      worker = createWorker(createApiRouter(env));
    }
    return worker.fetch(request);
  },
} satisfies ExportedHandler<Env>;
