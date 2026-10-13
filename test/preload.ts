import { GlobalRegistrator } from '@happy-dom/global-registrator';

// Keep Bun's server HTTP primitives: happy-dom's Request strips browser-forbidden
// headers such as Sec-Fetch-Site, hiding real Worker security behavior in tests.
const http = { Request, Response, Headers, fetch };
GlobalRegistrator.register();
Object.assign(globalThis, http);
