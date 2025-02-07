import type {
  ClientActionFunction,
  ClientActionFunctionArgs,
} from 'react-router';
import { z } from 'zod';
import { createSkills } from '../../utils/aiServices';

const formSchema = z.object({
  jobSearch: z.string(),
});

export const SkillsSchema = z.object({
  skills: z.object({
    expertRecommended: z.array(z.string()),
    other: z.array(z.string()),
  }),
});

export type TSkills = z.infer<typeof SkillsSchema>;

export const clientAction: ClientActionFunction = async ({
  request,
}: ClientActionFunctionArgs) => {
  const cloneData = request.clone();
  const formData = await cloneData.formData();
  const fields = Object.fromEntries(formData.entries());
  const result = formSchema.parse(fields);
  let skills = {
    skills: {
      expertRecommended: [
        'Programming Languages (e.g., Java, Python, C++)',
        'Problem-Solving',
        'Software Development Lifecycle',
        'Algorithms and Data Structures',
        'Debugging',
      ],
      other: [
        'Database Management',
        'Version Control Systems',
        'Agile Methodologies',
        'Communication Skills',
        'Teamwork',
      ],
    },
  };
  if (result.jobSearch) {
    // api call for cost savings
    skills = await createSkills(result.jobSearch);
    const finalResult = SkillsSchema.parse(skills);

    return Response.json(finalResult);
  }
  return Response.json(skills);
};

// example of how to do a clientLoader
export async function clientLoader({ request }: ClientActionFunctionArgs) {
  return Response.json({ ok: true });
}
