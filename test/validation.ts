import { type FieldErrors, fieldErrors } from '../shared/fieldErrors.ts';
import { z } from '../shared/zod.ts';

/** The Field errors a schema reports for a value it must reject. */
export function errorsFor(
  schema: z.core.$ZodType,
  value: unknown,
): FieldErrors {
  const result = z.safeParse(schema, value);
  if (result.success) throw new Error('Expected validation to fail');
  return fieldErrors(result.error);
}

/** The parsed output of a value a schema must accept. */
export function dataFor<T>(schema: z.core.$ZodType<T>, value: unknown): T {
  const result = z.safeParse(schema, value);
  if (!result.success) throw new Error('Expected validation to pass');
  return result.data;
}
