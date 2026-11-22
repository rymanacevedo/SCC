import { z } from './zod.ts';

export type FieldErrors = Record<string, string[] | undefined>;

export function fieldErrors(error: z.core.$ZodError): FieldErrors {
  const flattened = z.flattenError(error);
  const errors: FieldErrors = { ...flattened.fieldErrors };
  if (flattened.formErrors.length > 0) {
    errors._form = [...(errors._form ?? []), ...flattened.formErrors];
  }
  return errors;
}
