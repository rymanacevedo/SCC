import { z } from 'zod';
import { BaseEducationSchema } from '../routes/builder/education';
import { BaseExperienceSchema } from '../routes/builder/experience';
import { PersonalInfoSchema } from '../routes/builder/info';
import { SkillsSchema } from '../routes/builder/skills';
import { SummarySchema } from '../routes/builder/summary';

const PartialPersonalInfo = PersonalInfoSchema;
const PartialExperienceSchema = BaseExperienceSchema;
const PartialEducationSchema = BaseEducationSchema.partial();
const PartialSkillsSchema = SkillsSchema;
const PartialSummarySchema = SummarySchema;

export const UserSchema = z.object({
  userId: z.string(),
  info: PartialPersonalInfo.optional(),
  experience: z.array(PartialExperienceSchema).optional(),
  education: z.array(PartialEducationSchema).max(3).optional(),
  skills: PartialSkillsSchema.optional(),
  summary: PartialSummarySchema.optional(),
});

export type User = z.infer<typeof UserSchema>;
export type Experience = z.infer<typeof BaseExperienceSchema>;
export type Education = z.infer<typeof BaseEducationSchema>;

export function getUser(): User | null {
  const value = window.sessionStorage.getItem('user');
  try {
    if (value) {
      const user = JSON.parse(value);
      const parsedUser = UserSchema.parse(user);
      return parsedUser;
    }

    return null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export function getQueuedExperience(): Experience | null {
  const value = window.sessionStorage.getItem('queuedExperience');
  try {
    if (value) {
      const exp = JSON.parse(value);
      const parsedExp = BaseExperienceSchema.parse(exp);
      return parsedExp;
    }

    return null;
  } catch (error) {
    console.warn('No experience in the queue.');
    console.error(error);
    return null;
  }
}

export function setUser(user: User) {
  return window.sessionStorage.setItem('user', JSON.stringify(user));
}

export function setQueuedExperience(exp: Experience) {
  return window.sessionStorage.setItem('queuedExperience', JSON.stringify(exp));
}

export function updateUser<K extends Exclude<keyof User, 'userId'>>(
  key: K,
  newData: K extends 'experience'
    ?
        | Partial<(typeof BaseExperienceSchema)['_output']>
        | Partial<(typeof BaseExperienceSchema)['_output']>[]
    : K extends 'education'
      ?
          | Partial<(typeof BaseEducationSchema)['_output']>
          | Partial<(typeof BaseEducationSchema)['_output']>[]
      : Partial<User[K]>,
  index?: number,
): void {
  const currentUser = getUser();
  if (!currentUser) {
    console.warn('No user found in sessionStorage. Unable to update.');
    return;
  }

  let updatedField: User[K] | undefined;
  if (key === 'experience') {
    const currentExperience = (currentUser.experience || []) as (
      | Partial<(typeof BaseExperienceSchema)['_output']>
      | undefined
    )[];

    if (Array.isArray(newData)) {
      // Handle full array update
      updatedField = newData as User[K];
    } else if (typeof index === 'number') {
      // Handle single experience update at specific index
      const updatedExperience = [...currentExperience];
      updatedExperience[index] = newData as Partial<
        (typeof BaseExperienceSchema)['_output']
      >;
      updatedField = updatedExperience as User[K];
    } else {
      // Check if an experience with the same jobId already exists
      const newExperience = newData as Partial<
        (typeof BaseExperienceSchema)['_output']
      >;
      const existingIndex = currentExperience.findIndex(
        (exp) => exp?.jobId === newExperience.jobId,
      );

      if (existingIndex !== -1) {
        // Update existing experience
        const updatedExperience = [...currentExperience];
        updatedExperience[existingIndex] = newExperience;
        updatedField = updatedExperience as User[K];
      } else {
        // Add new experience
        updatedField = [...currentExperience, newExperience] as User[K];
      }
    }
  } else if (key === 'education') {
    const currentEducation = (currentUser.education || []) as (
      | Partial<(typeof BaseEducationSchema)['_output']>
      | undefined
    )[];

    if (Array.isArray(newData)) {
      // Handle full array update
      updatedField = newData as User[K];
    } else if (typeof index === 'number') {
      // Handle single education update at specific index (merge with existing)
      const updatedEducation = [...currentEducation];
      updatedEducation[index] = {
        ...updatedEducation[index],
        ...newData,
      } as Partial<(typeof BaseEducationSchema)['_output']>;
      updatedField = updatedEducation as User[K];
    } else {
      // Append new education entry
      updatedField = [...currentEducation, newData] as User[K];
    }
  } else {
    // Handle other fields
    updatedField = currentUser[key]
      ? ({ ...currentUser[key], ...newData } as User[K])
      : (newData as User[K]);
  }

  const updatedUser: User = {
    ...currentUser,
    [key]: updatedField,
  };

  setUser(updatedUser);
}

export function getRequiredUserTrait<K extends Exclude<keyof User, 'userId'>>(
  key: K,
): K extends 'experience'
  ? Required<NonNullable<(typeof BaseExperienceSchema)['_output']>>[]
  : K extends 'education'
    ? Required<NonNullable<(typeof BaseEducationSchema)['_output']>>[]
    : Required<NonNullable<User[K]>> {
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

  if (Array.isArray(trait)) {
    // Handle array type (experience)
    if (trait.length === 0) {
      throw new Error(`User trait "${String(key)}" array is empty.`);
    }

    trait.forEach((item, index) => {
      if (!item) {
        throw new Error(`User trait "${String(key)}[${index}]" is missing.`);
      }

      // Check each item's properties
      const itemRecord = item as Record<string, unknown>;
      for (const subKey in itemRecord) {
        if (itemRecord[subKey] == null) {
          throw new Error(
            `User trait "${String(key)}[${index}].${subKey}" is missing or null.`,
          );
        }
      }
    });
  } else {
    // Handle non-array types (info, skills, summary)
    const traitRecord = trait as Record<string, unknown>;
    for (const subKey in traitRecord) {
      if (traitRecord[subKey] == null) {
        throw new Error(
          `User trait property "${String(key)}.${subKey}" is missing or null.`,
        );
      }
    }
  }

  return trait as K extends 'experience'
    ? Required<NonNullable<(typeof BaseExperienceSchema)['_output']>>[]
    : K extends 'education'
      ? Required<NonNullable<(typeof BaseEducationSchema)['_output']>>[]
      : Required<NonNullable<User[K]>>;
}

export function clearQueuedExperience() {
  const exp = getQueuedExperience();
  if (!exp) {
    console.warn('No experience in the queued.');
    return;
  }

  sessionStorage.removeItem('queuedExperience');
}

export function getExperienceDetails(jobId: string) {
  const currentUser = getUser();
  if (!currentUser?.experience) {
    console.warn('No user or experience found.');
    return;
  }

  const experienceIndex = currentUser.experience.findIndex(
    (exp) => exp.jobId === jobId,
  );

  if (experienceIndex === -1) {
    console.warn(`No experience found for jobId: ${jobId}`);
    return;
  }

  return currentUser.experience[experienceIndex];
}

export function updateExperienceDetails(jobId: string, details: string[]) {
  const currentUser = getUser();
  if (!currentUser?.experience) {
    console.warn('No user or experience found in sessionStorage.');
    return;
  }

  const currentExperience = [...currentUser.experience];
  const experienceIndex = currentExperience.findIndex(
    (exp) => exp?.jobId === jobId,
  );

  if (experienceIndex === -1) {
    console.warn(`No experience found with jobId ${jobId}`);
    return;
  }

  currentExperience[experienceIndex] = {
    ...currentExperience[experienceIndex],
    details,
  };

  updateUser('experience', currentExperience);
}
