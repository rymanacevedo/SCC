import type { Handle } from 'remix/component';
import { z } from '../../shared/zod.ts';
export type FormValues = Record<string, string | string[]>;
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
export function isChecked(value: unknown): boolean {
  return value === true || value === 'on' || value === 'true';
}
export const checkbox = () => z.pipe(z.transform(isChecked), z.boolean());
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

export function repeatedStrings() {
  return z.pipe(
    z.transform((value: unknown) => {
      if (value === undefined) return [];
      return typeof value === 'string' ? [value] : value;
    }),
    z.array(z.string()),
  );
}

export function filledStrings() {
  return z.pipe(
    repeatedStrings(),
    z.transform((items) =>
      Array.from(new Set(items.filter((item) => item.trim()))),
    ),
  );
}
