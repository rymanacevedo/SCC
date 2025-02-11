import { z } from 'zod';
import { BaseExperienceSchema } from '../routes/builder/experience';
import { BaseEducationSchema } from '../routes/builder/education';
import { PersonalInfoSchema } from '../routes/builder/personalinfo';
import { SkillsSchema } from '../routes/builder/skills';
import { SummarySchema } from '../routes/builder/summary';

const PartialPersonalInfo = PersonalInfoSchema.partial();
const PartialExperienceSchema = BaseExperienceSchema.partial();
const PartialEducationSchema = BaseEducationSchema.partial();
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

export function updateUser<K extends Exclude<keyof User, 'userId'>>(
  key: K,
  newData: Partial<User[K]>,
): void {
  const currentUser = getUser();
  if (!currentUser) {
    console.warn('No user found in sessionStorage. Unable to update.');
    return;
  }

  const updatedField = currentUser[key]
    ? { ...currentUser[key], ...newData }
    : newData;

  const updatedUser: User = {
    ...currentUser,
    [key]: updatedField,
  };

  setUser(updatedUser);
}

export function getRequiredUserTrait<K extends Exclude<keyof User, 'userId'>>(
  key: K,
): Required<NonNullable<User[K]>> {
  const user = getUser();
  if (!user) {
    // TODO: redirect
    throw new Error('User not found in session storage.');
  }

  const trait = user[key];
  if (!trait) {
    // TODO: redirect
    throw new Error(`User trait "${String(key)}" is missing.`);
  }

  // Here, we iterate over the properties of the trait.
  // This is only a shallow check. If you need a deep check, you’d have to
  // perform a recursive validation.
  const traitRecord = trait as Record<string, unknown>;
  for (const subKey in traitRecord) {
    if (traitRecord[subKey] == null) {
      throw new Error(
        `User trait property "${String(key)}.${subKey}" is missing or null.`,
      );
    }
  }

  return trait as Required<NonNullable<User[K]>>;
}
