import { z } from 'zod';
import { filledStrings } from './form.ts';
/** The most experience details one job can carry. */
export const MAX_DETAILS = 6;
export const detailsFormSchema = z.object({
  jobId: z.string().min(1),
  details: filledStrings().refine((details) => details.length <= MAX_DETAILS, {
    message: 'You can add up to six details.',
  }),
});
