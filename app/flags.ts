import {
  FLAG_DEFAULTS,
  FLAGS_PATH,
  type FlagDefaults,
  type FlagSet,
  resolveFlags,
} from '../shared/flags.ts';

export interface FlagClient<D extends FlagDefaults> {
  current(): FlagSet<D>;
  load(): Promise<FlagSet<D>>;
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

  function notify(flags: FlagSet<D>) {
    for (const listener of listeners) {
      try {
        listener(flags);
      } catch {}
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

export const flags = createFlagClient();
