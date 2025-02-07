import type { z } from 'zod';

export const getFieldNames = <T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
): (keyof z.infer<typeof schema>)[] => {
  return Object.keys(schema.shape) as (keyof z.infer<typeof schema>)[];
};
