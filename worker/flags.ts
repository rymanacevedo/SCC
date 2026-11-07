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

// Envs already reported as having no binding, so the log fires once per env
// rather than once per request or once per isolate.
const reportedMissing = new WeakSet<object>();

// The FLAGS binding when env carries one. Without it every flag reads as its
// default: expected in tests and in local dev before the app exists, a
// misconfiguration in a deploy, so it is logged once per env.
export function flagsBinding(env: object): FlagsEnv['FLAGS'] {
  if (
    'FLAGS' in env &&
    typeof env.FLAGS === 'object' &&
    env.FLAGS !== null &&
    'getBooleanValue' in env.FLAGS
  ) {
    return env.FLAGS as FlagsEnv['FLAGS'];
  }
  if (!reportedMissing.has(env)) {
    reportedMissing.add(env);
    console.error({
      event: 'flags_binding_missing',
      category: 'configuration',
      detail: 'no FLAGS binding in env; every flag reads as its default',
    });
  }
  return {
    getBooleanValue: (_key, defaultValue) => Promise.resolve(defaultValue),
  };
}

export async function readFlags<D extends FlagDefaults = typeof FLAG_DEFAULTS>(
  env: FlagsEnv,
  defaults: D = FLAG_DEFAULTS as D,
): Promise<FlagSet<D>> {
  const raw: Record<string, boolean> = {};
  const failed: Record<string, string> = {};
  await Promise.all(
    flagNames(defaults).map(async (name) => {
      try {
        // No evaluation context: on/off only. The key is the flag name
        // verbatim and the fallback is the schema default, so the two cannot
        // diverge.
        raw[name] = await env.FLAGS.getBooleanValue(name, defaults[name]);
      } catch (error) {
        // Known failures already return the default; an unexpected runtime
        // failure can still throw. The flag stays at its default and the
        // failure is reported once per read, so a broken binding shows up in
        // observability rather than only as flags that are always off.
        failed[name] = error instanceof Error ? error.message : String(error);
      }
    }),
  );
  if (Object.keys(failed).length > 0) {
    console.error({
      event: 'flags_read_failed',
      category: 'configuration',
      flags: failed,
    });
  }
  return resolveFlags(raw, defaults);
}
