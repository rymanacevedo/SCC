import { z } from 'zod/mini';
import en from 'zod/v4/locales/en.js';

// The one Zod for client-reachable code: `zod/mini` keeps the startup bundle small.
// Unlike full `zod`, it ships no default messages; Users and the Worker's 400 bodies
// rely on Zod's English ones, so register them before any schema parses.
z.config(en());

export { z };
