import { z } from 'zod';

export const SummarySchema = z.object({
  summary: z.string().min(50, 'Summary should be at least 50 characters'),
});
