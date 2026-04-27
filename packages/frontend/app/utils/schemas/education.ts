import { z } from 'zod';

export const EducationLevelSchema = z.union([
  z.literal('GED'),
  z.literal('High School'),
  z.literal('Associates'),
  z.literal('Bachelors'),
  z.literal('Masters'),
  z.literal('PhD'),
  z.literal('Some College'),
  z.literal('Vocational'),
  z.literal('Certificate'),
]);

export const BaseEducationSchema = z.object({
  schoolName: z.string().min(1, 'School Name is required.'),
  educationLevel: EducationLevelSchema,
  degree: z.string().optional().default(''),
  location: z.string().optional().default(''),
  graduationDate: z
    .string()
    .transform((val) => {
      if (!val) return undefined;
      const year = Number.parseInt(val, 10);
      if (Number.isNaN(year)) return undefined;
      return year;
    })
    .pipe(
      z
        .number()
        .min(1900, { message: 'Graduation Year must be 1900 or later.' })
        .max(2099, { message: 'Graduation Year must be 2099 or earlier.' })
        .transform((year) => year.toString())
        .optional(),
    ),
  currentlyEnrolled: z.boolean().default(false),
});
