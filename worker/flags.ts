import {
  FLAG_DEFAULTS,
  type FlagDefaults,
  type FlagSet,
  flagNames,
  resolveFlags,
} from '../shared/flags.ts';

export interface FlagsEnv {
  FLAGS: Pick<Flagship, 'getBooleanValue'>;
}

const reportedMissing = new WeakSet<object>();

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
        raw[name] = await env.FLAGS.getBooleanValue(name, defaults[name]);
      } catch (error) {
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
