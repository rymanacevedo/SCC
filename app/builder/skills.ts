import { SkillsSchema } from '../../shared/schemas/skills.ts';
import { z } from '../../shared/zod.ts';
import { filledStrings } from './form.ts';
export const MAX_SKILLS = 6;
export const skillsFormSchema = z
  .extend(SkillsSchema, {
    expertRecommended: filledStrings(),
    other: filledStrings(),
  })
  .check(
    z.refine(
      (value) =>
        value.expertRecommended.length + value.other.length <= MAX_SKILLS,
      {
        path: ['other'],
        message: 'You can add up to six skills.',
      },
    ),
  );
