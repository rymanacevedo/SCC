// The one flag reader: resolves every known flag from the FLAGS KV namespace
// with a short cache, so a flip takes effect within about a minute without a
// deploy. No binding, a KV failure or an unexpected value reads as the
// default (off).
import {
  FLAG_DEFAULTS,
  type FlagDefaults,
  type Flags,
  resolveFlags,
} from '../shared/flags.ts';

// Cloudflare caches KV reads at the edge for at least 60 seconds (cacheTtl
// minimum); the in-isolate cache avoids a KV call per request.
const CACHE_MS = 30_000;
const KV_CACHE_TTL_S = 60;

export interface FlagsEnv {
  FLAGS: KVNamespace;
}

// The FLAGS binding when wrangler.jsonc declares one (the runbook's setup
// step); undefined otherwise, which the reader serves as every default.
export function flagsBinding(env: object): KVNamespace | undefined {
  const binding = (env as Partial<FlagsEnv>).FLAGS;
  return typeof binding?.get === 'function' ? binding : undefined;
}

export type FlagReader = (env: object) => Promise<Flags>;

// A reader with its own cache. The Worker uses the one below over
// FLAG_DEFAULTS; tests build one over their own flags and clock.
export function createFlagReader({
  defaults = FLAG_DEFAULTS,
  now = Date.now,
}: { defaults?: FlagDefaults; now?: () => number } = {}): FlagReader {
  let cached: { at: number; flags: Flags } | undefined;
  return async (env) => {
    const at = now();
    if (cached && at - cached.at < CACHE_MS) return cached.flags;
    const kv = flagsBinding(env);
    const raw: Record<string, string | null> = {};
    if (kv) {
      await Promise.all(
        Object.keys(defaults).map(async (name) => {
          try {
            raw[name] = await kv.get(name, { cacheTtl: KV_CACHE_TTL_S });
          } catch {
            // Leave the flag at its default.
          }
        }),
      );
    }
    const flags = resolveFlags(raw, defaults);
    cached = { at, flags };
    return flags;
  };
}

export const readFlags: FlagReader = createFlagReader();
