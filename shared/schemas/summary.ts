import { z } from '../zod.ts';

export const SummarySchema = z.object({
  summary: z
    .string()
    .check(z.minLength(50, 'Summary should be at least 50 characters')),
});
