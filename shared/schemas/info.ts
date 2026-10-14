import { z } from '../zod.ts';

export const PersonalInfoSchema = z.object({
  firstName: z.string().check(z.minLength(1, 'First name is required')),
  lastName: z.string().check(z.minLength(1, 'Last name is required')),
  city: z.string().check(z.minLength(1, 'City is required')),
  state: z.string().check(z.minLength(2, 'State is required')),
  zipCode: z.string().check(z.regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code')),
  phone: z
    .pipe(
      z.optional(z.string()),
      z.transform((val) => (val ? val.replace(/-/g, '') : val)),
    )
    .check(
      z.refine((val) => !val || /^\d{10}$/.test(val), {
        message: 'Phone number must be 10 digits',
      }),
    ),
  email: z.email('Invalid email address'),
});
