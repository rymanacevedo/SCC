import { z } from 'zod';

export const PersonalInfoSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(2, 'State is required'),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code'),
  phone: z
    .string()
    .optional()
    .transform((val) => (val ? val.replace(/-/g, '') : val))
    .refine((val) => !val || /^\d{10}$/.test(val), {
      message: 'Phone number must be 10 digits',
    }),
  email: z.string().email('Invalid email address'),
});
