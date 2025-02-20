import {
  data,
  type ClientActionFunction,
  type ClientActionFunctionArgs,
} from 'react-router';
import { z } from 'zod';
import { createSkills } from '../../utils/aiServices';
import type { FormErrors } from '../../components/Input';
import { filter } from '../../utils/filter';

const formSchema = z.object({
  jobSearch: z.string(),
});

type FormSubmission = z.infer<typeof formSchema>;
export const SkillsSchema = z.object({
  expertRecommended: z.array(z.string()),
  other: z.array(z.string()),
});

const containsInappropriateWords = (input: string): string | null => {
  if (filter.isProfane(input)) {
    return input.split(' ').find((word) => filter.isProfane(word)) || null;
  }
  return null;
};

export const clientAction: ClientActionFunction = async ({
  request,
}: ClientActionFunctionArgs) => {
  const cloneData = request.clone();
  const formData = await cloneData.formData();
  const fields = Object.fromEntries(formData.entries());
  let result: FormSubmission;

  try {
    result = formSchema.parse(fields);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return data(
        { errors: error.flatten().fieldErrors as FormErrors },
        { status: 400 },
      );
    }
    return data(
      { errors: { _form: ['An errored occured.'] } },
      { status: 409 },
    );
  }

  const badWord = containsInappropriateWords(result.jobSearch);
  if (badWord) {
    return Response.json(
      { error: `The term "${badWord}" is not allowed.` },
      { status: 400 },
    );
  }

  if (result.jobSearch) {
    const skills = await createSkills(result.jobSearch);
    const finalResult = SkillsSchema.parse(skills);

    return Response.json(finalResult);
  }
  return Response.json({});
};

// example of how to do a clientLoader
export async function clientLoader({ request }: ClientActionFunctionArgs) {
  return Response.json({ ok: true });
}
