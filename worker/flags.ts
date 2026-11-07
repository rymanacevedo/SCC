// The one flag reader: resolves every known flag through the FLAGS Flagship
// binding. Flagship evaluates in the Worker, so there is no cache here: a
// flip is live on the next request. A flag Flagship does not know, a value
// of another type or a binding failure yields the schema default.
import {
  FLAG_DEFAULTS,
  type FlagDefaults,
  type FlagSet,
  flagNames,
  resolveFlags,
} from '../shared/flags.ts';

// Only the method the reader calls, so a test can pass a plain stub; the
// generated Env (bun run types) satisfies it with FLAGS: Flagship.
export interface FlagsEnv {
  FLAGS: Pick<Flagship, 'getBooleanValue'>;
}

export async function readFlags<D extends FlagDefaults = typeof FLAG_DEFAULTS>(
  env: FlagsEnv,
  defaults: D = FLAG_DEFAULTS as D,
): Promise<FlagSet<D>> {
  const raw: Record<string, boolean> = {};
  await Promise.all(
    flagNames(defaults).map(async (name) => {
      try {
        // No evaluation context: on/off only. The key is the flag name
        // verbatim and the fallback is the schema default, so the two cannot
        // diverge.
        raw[name] = await env.FLAGS.getBooleanValue(name, defaults[name]);
      } catch {
        // Known failures already return the default; an unexpected runtime
        // failure can still throw. Leave the flag at its default.
      }
    }),
  );
  return resolveFlags(raw, defaults);
}
