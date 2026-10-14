import { z } from '../../shared/zod.ts';
import { filledStrings } from './form.ts';
/** The most experience details one job can carry. */
export const MAX_DETAILS = 6;
export const detailsFormSchema = z.object({
  jobId: z.string().check(z.minLength(1)),
  details: filledStrings().check(
    z.refine((details) => details.length <= MAX_DETAILS, {
      message: 'You can add up to six details.',
    }),
  ),
});
