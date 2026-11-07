// Feature flag schema: every known flag and its default. Shared by the Worker
// (reader and route) and the client (fallback when the route fails). The
// Flagship binding cannot list flags, so this map is the one key set.
//
// Rules (docs/runbooks/feature-flags.md):
// - every default is false; a flag turns a feature on, never off;
// - the PR that adds a flag here also creates it in Flagship (default off)
//   and files the issue that removes it;
// - the Flagship flag key is the property name below, verbatim.

export const FLAG_DEFAULTS = {
  // exampleFlag: false,
} as const satisfies Record<string, false>;

// The one route path, used by the Worker route and the client.
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

// Only known flags with a boolean value survive; anything else is the
// default. The defaults map is a parameter so tests can use a fixture set
// without adding a production flag.
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
