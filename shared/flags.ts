// Feature flag schema: every known flag and its default. Shared by the Worker
// (reader and route) and the client (fallback when the route fails).
//
// Rules (docs/runbooks/feature-flags.md):
// - every default is false; a flag turns a feature on, never off;
// - the PR that adds a flag here also files the issue that removes it;
// - the KV key for a flag is its name; the value is "true" or "false".

export const FLAG_DEFAULTS = {
  // exampleFlag: false,
} as const satisfies Record<string, false>;

export type FlagName = keyof typeof FLAG_DEFAULTS;
export type Flags = Record<FlagName, boolean>;

export const FLAG_NAMES = Object.keys(FLAG_DEFAULTS) as FlagName[];

// Only known flags with a boolean value survive; anything else is the default.
export function resolveFlags(raw: Partial<Record<string, unknown>>): Flags {
  // Built as a plain record so this typechecks while FLAG_DEFAULTS is empty
  // (FlagName is `never` then); only known names are ever written.
  const flags: Record<string, boolean> = { ...FLAG_DEFAULTS };
  for (const name of FLAG_NAMES) {
    const value = raw[name];
    if (typeof value === 'boolean') flags[name] = value;
  }
  return flags as Flags;
}
