import { GlobalRegistrator } from '@happy-dom/global-registrator';

const http = { Request, Response, Headers, fetch };
GlobalRegistrator.register();
Object.assign(globalThis, http);
