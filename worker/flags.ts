// The one flag reader: resolves every known flag from the FLAGS KV namespace
// with a short cache, so a flip takes effect within about a minute without a
// deploy. A KV failure or an unexpected value yields the default (off).
import { FLAG_NAMES, type Flags, resolveFlags } from '../shared/flags.ts';

// Cloudflare caches KV reads at the edge for at least 60 seconds (cacheTtl
// minimum); the in-isolate cache below avoids a KV call per request.
const CACHE_MS = 30_000;
const KV_CACHE_TTL_S = 60;

export interface FlagsEnv {
  FLAGS: KVNamespace;
}

let cached: { at: number; flags: Flags } | undefined;

export async function readFlags(
  env: FlagsEnv,
  now = Date.now(),
): Promise<Flags> {
  if (cached && now - cached.at < CACHE_MS) return cached.flags;
  const raw: Record<string, boolean> = {};
  await Promise.all(
    FLAG_NAMES.map(async (name) => {
      try {
        const value = await env.FLAGS.get(name, { cacheTtl: KV_CACHE_TTL_S });
        if (value === 'true' || value === 'false') raw[name] = value === 'true';
      } catch {
        // Leave the flag at its default.
      }
    }),
  );
  const flags = resolveFlags(raw);
  cached = { at: now, flags };
  return flags;
}

// Tests only: forget the cached set.
export function resetFlagCache(): void {
  cached = undefined;
}
