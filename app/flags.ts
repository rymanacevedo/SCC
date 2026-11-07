// The one client reader for GET /api/flags. getFlags() is a snapshot: the
// defaults until loadFlags() has settled, then the loaded set. A caller that
// renders before that awaits loadFlags() or subscribes with subscribeFlags()
// to be told when the set changes. On any failure the set is the defaults and
// the next loadFlags() retries. Framework-neutral: no React hook.
import {
  FLAG_DEFAULTS,
  FLAGS_PATH,
  type FlagDefaults,
  type FlagSet,
  resolveFlags,
} from '../shared/flags.ts';

export interface FlagClient<D extends FlagDefaults> {
  // The current set: defaults until a load settles.
  current(): FlagSet<D>;
  // Fetch once; concurrent calls share the request. Never rejects.
  load(): Promise<FlagSet<D>>;
  // Called after every settled load with the new set; returns unsubscribe.
  subscribe(listener: (flags: FlagSet<D>) => void): () => void;
}

export function createFlagClient<
  D extends FlagDefaults = typeof FLAG_DEFAULTS,
>({
  defaults = FLAG_DEFAULTS as D,
  fetcher = fetch,
  url = FLAGS_PATH,
}: {
  defaults?: D;
  fetcher?: typeof fetch;
  url?: string;
} = {}): FlagClient<D> {
  let current = resolveFlags({}, defaults);
  let pending: Promise<FlagSet<D>> | undefined;
  const listeners = new Set<(flags: FlagSet<D>) => void>();

  function settle(flags: FlagSet<D>) {
    current = flags;
    pending = undefined;
    for (const listener of listeners) listener(flags);
    return flags;
  }

  return {
    current: () => current,
    load() {
      pending ??= fetcher(url, { headers: { Accept: 'application/json' } })
        .then(async (res) => {
          if (!res.ok) throw new Error(`flags: HTTP ${res.status}`);
          const body = (await res.json()) as {
            flags?: Record<string, unknown>;
          };
          return settle(resolveFlags(body.flags ?? {}, defaults));
        })
        .catch(() => settle(resolveFlags({}, defaults)));
      return pending;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const client = createFlagClient();
export const getFlags = client.current;
export const loadFlags = client.load;
export const subscribeFlags = client.subscribe;
