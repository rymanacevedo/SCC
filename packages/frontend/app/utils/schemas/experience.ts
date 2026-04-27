import { z } from 'zod';

export const BaseExperienceSchema = z.object({
  jobId: z.string().min(1),
  jobTitle: z.string().min(1, 'Job Title is required.'),
  employer: z.string().min(1, 'Employer is required.'),
  city: z.string().min(1, 'City is required.'),
  state: z.string().min(1, 'State is required.'),
  startDate: z
    .string()
    .min(1, 'Start date is required.')
    .transform((date) => new Date(date))
    .refine((date) => !Number.isNaN(date.getTime), {
      message: 'Invalid start date format.',
    })
    .refine((date) => date <= new Date(), {
      message: 'Start date cannot be in the future.',
    }),
  endDate: z
    .string()
    .transform((date) => (date ? new Date(date) : undefined))
    .optional()
    .refine((date) => !date || !Number.isNaN(date.getTime), {
      message: 'Invalid end date format',
    }),
  currentlyEmployed: z.boolean().default(false),
  details: z.array(z.string()).optional(),
});
