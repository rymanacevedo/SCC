import type { Handle } from 'remix/component';
import { z } from 'zod';
export type FormValues = Record<string, string | string[]>;
/** Repeated names become arrays; pages never decode their own POST bodies. */
export function formValues(data: FormData): FormValues {
  const values: FormValues = Object.create(null);
  for (const [name, entry] of data) {
    if (typeof entry !== 'string') continue;
    const previous = values[name];
    if (previous === undefined) {
      values[name] = entry;
    } else if (Array.isArray(previous)) {
      values[name] = [...previous, entry];
    } else {
      values[name] = [previous, entry];
    }
  }
  return values;
}
export function entryFormValues(entry: object): FormValues {
  return Object.fromEntries(
    Object.entries(entry).map(([key, value]) => [
      key,
      typeof value === 'boolean' ? String(value) : value,
    ]),
  ) as FormValues;
}
export const checkbox = () =>
  z.preprocess(
    (value) => value === true || value === 'on' || value === 'true',
    z.boolean(),
  );
export function formPending<P>(handle: Handle<P>) {
  let pending = false;
  handle.queueTask(() => {
    handle.frame.addEventListener(
      'reloadComplete',
      () => {
        pending = false;
        void handle.update();
      },
      { signal: handle.signal },
    );
  });
  return {
    get pending() {
      return pending;
    },
    submit(event: Event) {
      if (pending) {
        event.preventDefault();
        return;
      }
      pending = true;
      void handle.update();
    },
  };
}

/** Normalize zero, one, or many repeated string fields before page validation. */
export function repeatedStrings() {
  return z.preprocess((value) => {
    if (value === undefined) return [];
    return typeof value === 'string' ? [value] : value;
  }, z.array(z.string()));
}
