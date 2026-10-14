import { z } from '../zod.ts';
import { EducationLevelSchema } from './education.ts';

// Persistence validates shape, not the limits imposed by individual Builder pages.
export const storedInfoSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  city: z.string(),
  state: z.string(),
  zipCode: z.string(),
  phone: z.optional(z.string()),
  email: z.string(),
});
export const storedExperienceSchema = z.object({
  jobId: z.string().check(z.minLength(1)),
  jobTitle: z.string(),
  employer: z.string(),
  city: z.string(),
  state: z.string(),
  startDate: z.string(),
  endDate: z.optional(z.string()),
  currentlyEmployed: z.boolean(),
  details: z.optional(z.array(z.string())),
});
export const storedEducationSchema = z.object({
  educationId: z.string().check(z.minLength(1)),
  schoolName: z.optional(z.string()),
  educationLevel: z.optional(EducationLevelSchema),
  degree: z.optional(z.string()),
  location: z.optional(z.string()),
  graduationDate: z.optional(z.string()),
  currentlyEnrolled: z.optional(z.boolean()),
});
/** One entry of each list Section, validated alone when it is committed. */
export const entrySchemas = {
  experience: storedExperienceSchema,
  education: storedEducationSchema,
};
export const sectionSchemas = {
  info: storedInfoSchema,
  experience: z.array(entrySchemas.experience),
  education: z.array(entrySchemas.education),
  skills: z.object({
    expertRecommended: z.array(z.string()),
    other: z.array(z.string()),
  }),
  summary: z.object({ summary: z.string() }),
};
export const UserSchema = z.object({
  info: z.optional(sectionSchemas.info),
  experience: z.optional(sectionSchemas.experience),
  education: z.optional(sectionSchemas.education),
  skills: z.optional(sectionSchemas.skills),
  summary: z.optional(sectionSchemas.summary),
});
export type User = z.infer<typeof UserSchema>;
export type Section = keyof User;
export const draftSchemas = {
  experience: z.partial(entrySchemas.experience),
  education: z.partial(entrySchemas.education),
};
export const draftsSchema = z.object({
  experience: z.optional(draftSchemas.experience),
  education: z.optional(draftSchemas.education),
});
export type Drafts = z.infer<typeof draftsSchema>;
