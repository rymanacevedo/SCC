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
/** A checkbox answer: "on" when typed, "true" when read back from the User. */
export function isChecked(value: unknown): boolean {
  return value === true || value === 'on' || value === 'true';
}
export const checkbox = () => z.preprocess(isChecked, z.boolean());
/** A stored ISO date (or typed "YYYY-MM") as the value of a month input. */
export function monthValue(value: FormValues[string] | undefined): string {
  if (typeof value !== 'string') return '';
  return /^\d{4}-\d{2}/.test(value) ? value.slice(0, 7) : value;
}
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

/** Repeated strings with blank and duplicate answers dropped: a list builder's pending typed entry submits alongside the picked items. */
export function filledStrings() {
  return repeatedStrings().transform((items) =>
    Array.from(new Set(items.filter((item) => item.trim()))),
  );
}
