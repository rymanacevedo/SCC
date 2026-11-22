export const FLAG_DEFAULTS = {} as const satisfies Record<string, false>;

export const FLAGS_PATH = '/api/flags';

export type FlagDefaults = Readonly<Record<string, boolean>>;
export type FlagSet<D extends FlagDefaults> = Record<keyof D & string, boolean>;
export type FlagName = keyof typeof FLAG_DEFAULTS;
export type Flags = FlagSet<typeof FLAG_DEFAULTS>;

export function flagNames<D extends FlagDefaults>(
  defaults: D,
): (keyof D & string)[] {
  return Object.keys(defaults) as (keyof D & string)[];
}

export function resolveFlags<D extends FlagDefaults = typeof FLAG_DEFAULTS>(
  raw: Partial<Record<string, unknown>>,
  defaults: D = FLAG_DEFAULTS as D,
): FlagSet<D> {
  const flags: Record<string, boolean> = { ...defaults };
  for (const name of flagNames(defaults)) {
    const value = raw[name];
    if (typeof value === 'boolean') flags[name] = value;
  }
  return flags as FlagSet<D>;
}
