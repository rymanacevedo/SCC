// The one client reader of GET /api/flags. getFlags() is a synchronous
// snapshot: the defaults until loadFlags() has settled, and the defaults
// again whenever the request fails or returns something unexpected. Nothing
// re-renders on its own: await loadFlags() once, in a loader or before the
// first render that needs a flag, then read getFlags() anywhere.
import {
  FLAG_DEFAULTS,
  type FlagDefaults,
  type Flags,
  resolveFlags,
} from '../shared/flags.ts';

export const FLAGS_URL = '/api/flags';

export interface FlagClient {
  // One request per page load while it succeeds. A failure settles to the
  // defaults and forgets the request, so the next call retries.
  load(): Promise<Flags>;
  // The last loaded set, or the defaults.
  current(): Flags;
}

// A client with its own state. The app uses the one below over FLAG_DEFAULTS
// and the global fetch; tests build one over their own flags and fetcher.
export function createFlagClient({
  defaults = FLAG_DEFAULTS,
  fetcher,
}: { defaults?: FlagDefaults; fetcher?: typeof fetch } = {}): FlagClient {
  let current = resolveFlags({}, defaults);
  let pending: Promise<Flags> | undefined;
  async function request(): Promise<Flags> {
    const res = await (fetcher ?? fetch)(FLAGS_URL, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`flags: HTTP ${res.status}`);
    const body = (await res.json()) as { flags?: Record<string, unknown> };
    return resolveFlags(body.flags ?? {}, defaults);
  }
  return {
    load() {
      pending ??= request().then(
        (flags) => (current = flags),
        () => {
          pending = undefined;
          return (current = resolveFlags({}, defaults));
        },
      );
      return pending;
    },
    current: () => current,
  };
}

const client = createFlagClient();
export const loadFlags = (): Promise<Flags> => client.load();
export const getFlags = (): Flags => client.current();
