// The one client reader for GET /api/flags. flags.current() is a snapshot:
// the defaults until flags.load() has settled, then the loaded set. A caller
// that renders before that awaits flags.load() or calls flags.subscribe() to
// be told when the set changes. On any failure the set is the defaults and
// the next load() retries. Framework-neutral: no React hook.
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

  // A listener that throws is that listener's problem: the loaded set stays,
  // the other listeners still run and load() still resolves.
  function notify(flags: FlagSet<D>) {
    for (const listener of listeners) {
      try {
        listener(flags);
      } catch {
        // Reported nowhere on purpose: the client has no logger and the
        // listener is app code that can catch its own errors.
      }
    }
  }

  async function request(): Promise<FlagSet<D>> {
    try {
      const res = await fetcher(url, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`flags: HTTP ${res.status}`);
      const body = (await res.json()) as { flags?: Record<string, unknown> };
      return resolveFlags(body.flags ?? {}, defaults);
    } catch {
      return resolveFlags({}, defaults);
    }
  }

  return {
    current: () => current,
    load() {
      pending ??= request().then((flags) => {
        current = flags;
        pending = undefined;
        notify(flags);
        return flags;
      });
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

// The app's one client over the production flag set.
export const flags = createFlagClient();
