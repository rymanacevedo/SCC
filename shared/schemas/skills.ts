import { z } from '../zod.ts';

export const SkillsSchema = z.object({
  expertRecommended: z.array(z.string()),
  other: z.array(z.string()),
});
