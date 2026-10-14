import { z } from '../zod.ts';

export const BaseExperienceSchema = z.object({
  jobId: z.string().check(z.minLength(1)),
  jobTitle: z.string().check(z.minLength(1, 'Job Title is required.')),
  employer: z.string().check(z.minLength(1, 'Employer is required.')),
  city: z.string().check(z.minLength(1, 'City is required.')),
  state: z.string().check(z.minLength(1, 'State is required.')),
  startDate: z
    .pipe(
      z.string().check(z.minLength(1, 'Start date is required.')),
      z.transform((date) => new Date(date)),
    )
    .check(
      z.refine((date) => !Number.isNaN(date.getTime()), {
        message: 'Invalid start date format.',
      }),
      z.refine((date) => date <= new Date(), {
        message: 'Start date cannot be in the future.',
      }),
    ),
  endDate: z
    .optional(
      z.pipe(
        z.string(),
        z.transform((date) => (date ? new Date(date) : undefined)),
      ),
    )
    .check(
      z.refine((date) => !date || !Number.isNaN(date.getTime()), {
        message: 'Invalid end date format',
      }),
    ),
  currentlyEmployed: z.prefault(z.boolean(), false),
  details: z.optional(z.array(z.string())),
});
