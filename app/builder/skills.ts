import { SkillsSchema } from '../../shared/schemas/skills.ts';
import { filledStrings } from './form.ts';
export const MAX_SKILLS = 6;
export const skillsFormSchema = SkillsSchema.extend({
  expertRecommended: filledStrings(),
  other: filledStrings(),
}).refine(
  (value) => value.expertRecommended.length + value.other.length <= MAX_SKILLS,
  {
    path: ['other'],
    message: 'You can add up to six skills.',
  },
);
