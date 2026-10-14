import { z } from '../zod.ts';

export const educationLevels = [
  'GED',
  'High School',
  'Associates',
  'Bachelors',
  'Masters',
  'PhD',
  'Some College',
  'Vocational',
  'Certificate',
] as const;

export const EducationLevelSchema = z.union(
  educationLevels.map((level) => z.literal(level)),
);

export const BaseEducationSchema = z.object({
  schoolName: z.string().check(z.minLength(1, 'School Name is required.')),
  educationLevel: EducationLevelSchema,
  degree: z.prefault(z.string(), ''),
  location: z.prefault(z.string(), ''),
  graduationDate: z.pipe(
    z.prefault(z.string(), '').check(
      z.refine(
        (value) => value === '' || /^\d{4}$/.test(value),
        'Graduation Year must be a four-digit year.',
      ),
      z.refine(
        (value) => !value || Number(value) >= 1900,
        'Graduation Year must be 1900 or later.',
      ),
      z.refine(
        (value) => !value || Number(value) <= 2099,
        'Graduation Year must be 2099 or earlier.',
      ),
    ),
    z.transform((value) => value || undefined),
  ),
  currentlyEnrolled: z.prefault(z.boolean(), false),
});
