import type { Handle } from 'remix/component';
import { z } from 'zod';
export type FormValues = Record<string, string | string[]>;
/** Repeated names become arrays; pages never decode their own POST bodies. */
export function formValues(data: FormData): FormValues {
  const values: FormValues = Object.create(null);
  for (const [name, entry] of data) {
    if (typeof entry !== 'string') continue;
    const previous = values[name];
    values[name] =
      previous === undefined
        ? entry
        : [...(Array.isArray(previous) ? previous : [previous]), entry];
  }
  return values;
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
