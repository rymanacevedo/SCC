import { z } from 'zod';
import { ExperienceSchema } from '../routes/builder/experience';
import { EducationSchema } from '../routes/builder/education';
import { PersonalInfoSchema } from '../routes/builder/personalinfo';
import { SkillsSchema } from '../routes/builder/skills';
import { SummarySchema } from '../routes/builder/summary';

const PartialPersonalInfo = PersonalInfoSchema.partial();
const PartialExperienceSchema = ExperienceSchema.partial();
const PartialEducationSchema = EducationSchema.partial();
const PartialSkillsSchema = SkillsSchema.partial();
const PartialSummarySchema = SummarySchema.partial();

export const UserSchema = z.object({
  userId: z.string(),
  info: PartialPersonalInfo.optional(),
  experience: PartialExperienceSchema.optional(),
  education: PartialEducationSchema.optional(),
  skills: PartialSkillsSchema.optional(),
  summary: PartialSummarySchema.optional(),
});

export type User = z.infer<typeof UserSchema>;

export function getUser(): User | null {
  const value = window.sessionStorage.getItem('user');
  try {
    if (value) {
      const user = JSON.parse(value);
      UserSchema.parse(user);
      return user;
    }

    return null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export function setUser(user: User) {
  return window.sessionStorage.setItem('user', JSON.stringify(user));
}
