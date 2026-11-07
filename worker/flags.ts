// The one flag reader: resolves every known flag through the FLAGS Flagship
// binding. Flagship evaluates in the Worker, so there is no cache here: a
// flip is live on the next request. A flag Flagship does not know, a value
// of another type or a binding failure yields the default (off).
import { FLAG_NAMES, type Flags, resolveFlags } from '../shared/flags.ts';

// Only the method the reader calls, so a test can pass a plain stub; the
// generated Env (bun run types) satisfies it with FLAGS: Flagship.
export interface FlagsEnv {
  FLAGS: Pick<Flagship, 'getBooleanValue'>;
}

export async function readFlags(env: FlagsEnv): Promise<Flags> {
  const raw: Record<string, boolean> = {};
  await Promise.all(
    FLAG_NAMES.map(async (name) => {
      try {
        // No evaluation context: on/off only. The key is the flag name verbatim.
        raw[name] = await env.FLAGS.getBooleanValue(name, false);
      } catch {
        // Known failures already return the default; an unexpected runtime
        // failure can still throw. Leave the flag at its default.
      }
    }),
  );
  return resolveFlags(raw);
}
