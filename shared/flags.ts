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

export type FlagName = keyof typeof FLAG_DEFAULTS;
export type Flags = Record<FlagName, boolean>;

export const FLAG_NAMES: readonly string[] = Object.keys(FLAG_DEFAULTS);

// Only known flags with a boolean value survive; anything else is the default.
export function resolveFlags(raw: Partial<Record<string, unknown>>): Flags {
  const flags: Record<string, boolean> = { ...FLAG_DEFAULTS };
  for (const name of FLAG_NAMES) {
    const value = raw[name];
    if (typeof value === 'boolean') flags[name] = value;
  }
  return flags as Flags;
}
