// The one client hook: useFlags() gives the resolved flag set from
// GET /api/flags. Until the request settles, and whenever it fails or returns
// something unexpected, every flag is its default (off). Framework-neutral:
// call it from any component or loader; the request is made once per page load.
import { FLAG_DEFAULTS, type Flags, resolveFlags } from '../shared/flags.ts';

const FLAGS_URL = '/api/flags';
let current: Flags = { ...FLAG_DEFAULTS };
let pending: Promise<Flags> | undefined;

export function loadFlags(fetcher: typeof fetch = fetch): Promise<Flags> {
  pending ??= fetcher(FLAGS_URL, { headers: { Accept: 'application/json' } })
    .then(async (res) => {
      if (!res.ok) throw new Error(`flags: HTTP ${res.status}`);
      const body = (await res.json()) as { flags?: Record<string, unknown> };
      current = resolveFlags(body.flags ?? {});
      return current;
    })
    .catch(() => {
      current = { ...FLAG_DEFAULTS };
      return current;
    });
  return pending;
}

// Synchronous read: the defaults until loadFlags() has settled.
export function useFlags(): Flags {
  void loadFlags();
  return current;
}
