import type { ClientActionFunction, data } from 'react-router';
import { z } from 'zod';
import { createSkills } from '../../utils/aiServices';

export const SkillsAction: ClientActionFunction = async ({ request }) => {
  const cloneData = request.clone();
  const formData = await cloneData.formData();

  return { ok: true };
};
