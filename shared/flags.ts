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
// A flag set with its defaults: FLAG_DEFAULTS in the app, any set in tests.
export type FlagDefaults = Readonly<Record<string, boolean>>;

// The one parser for a flag value, stored (KV string) or transmitted (JSON
// boolean). Anything else is undefined: the caller keeps the default.
export function parseFlagValue(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

// Every known flag: raw's value where it parses, the default otherwise.
// Unknown names in raw are dropped.
export function resolveFlags(
  raw: Readonly<Record<string, unknown>>,
  defaults: FlagDefaults = FLAG_DEFAULTS,
): Flags {
  // Built as a plain record so this typechecks while FLAG_DEFAULTS is empty
  // (FlagName is `never` then); only known names are ever written.
  const flags: Record<string, boolean> = {};
  for (const [name, fallback] of Object.entries(defaults)) {
    flags[name] = parseFlagValue(raw[name]) ?? fallback;
  }
  return flags as Flags;
}
