import { z } from './zod.ts';

export type FieldErrors = Record<string, string[] | undefined>;

/** Fold nested Field errors to their top-level field and Form errors to _form. */
export function fieldErrors(error: z.core.$ZodError): FieldErrors {
  const flattened = z.flattenError(error);
  const errors: FieldErrors = { ...flattened.fieldErrors };
  if (flattened.formErrors.length > 0) {
    errors._form = [...(errors._form ?? []), ...flattened.formErrors];
  }
  return errors;
}
