import { z } from 'zod';
import { EducationLevelSchema } from './education.ts';

// Persistence validates shape, not the limits imposed by individual Builder pages.
export const storedInfoSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  city: z.string(),
  state: z.string(),
  zipCode: z.string(),
  phone: z.string().optional(),
  email: z.string(),
});
export const storedExperienceSchema = z.object({
  jobId: z.string().min(1),
  jobTitle: z.string(),
  employer: z.string(),
  city: z.string(),
  state: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
  currentlyEmployed: z.boolean(),
  details: z.array(z.string()).optional(),
});
export const storedEducationSchema = z.object({
  educationId: z.string().min(1),
  schoolName: z.string().optional(),
  educationLevel: EducationLevelSchema.optional(),
  degree: z.string().optional(),
  location: z.string().optional(),
  graduationDate: z.string().optional(),
  currentlyEnrolled: z.boolean().optional(),
});
export const sectionSchemas = {
  info: storedInfoSchema,
  experience: z.array(storedExperienceSchema),
  education: z.array(storedEducationSchema),
  skills: z.object({
    expertRecommended: z.array(z.string()),
    other: z.array(z.string()),
  }),
  summary: z.object({ summary: z.string() }),
};
export const UserSchema = z.object({
  info: sectionSchemas.info.optional(),
  experience: sectionSchemas.experience.optional(),
  education: sectionSchemas.education.optional(),
  skills: sectionSchemas.skills.optional(),
  summary: sectionSchemas.summary.optional(),
});
export type User = z.infer<typeof UserSchema>;
export type Section = keyof User;
export const draftSchemas = {
  experience: storedExperienceSchema.partial(),
  education: storedEducationSchema.partial(),
};
export const draftsSchema = z.object({
  experience: draftSchemas.experience.optional(),
  education: draftSchemas.education.optional(),
});
export type Drafts = z.infer<typeof draftsSchema>;
