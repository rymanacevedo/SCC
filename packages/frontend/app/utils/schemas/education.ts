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
  degree: z.string().prefault(''),
  location: z.string().prefault(''),
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
  currentlyEnrolled: z.boolean().prefault(false),
});

// Stored and queued education may be incomplete. Zod 3's partial schema skipped
// defaults for absent fields; Zod 4 applies even prefaults inside optional fields.
export const PartialEducationSchema = BaseEducationSchema.partial().extend({
  degree: BaseEducationSchema.shape.degree.unwrap().optional(),
  location: BaseEducationSchema.shape.location.unwrap().optional(),
  currentlyEnrolled: BaseEducationSchema.shape.currentlyEnrolled
    .unwrap()
    .optional(),
});
