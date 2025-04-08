import {
  data,
  type ClientActionFunction,
  type ClientActionFunctionArgs,
} from 'react-router';
import { z } from 'zod';
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
    const bckEndUrl = `${import.meta.env.VITE_HONO_BACKEND_URL}/api/skills`;
    const res = await fetch(bckEndUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: result.jobSearch }),
    });
    if (!res.ok) {
      throw new Error(`HTTP error! status ${res.status}`);
    }
    const skills = await res.json();
    return Response.json(skills);
  }
  return Response.json({});
};

// example of how to do a clientLoader
export async function clientLoader({ request }: ClientActionFunctionArgs) {
  return Response.json({ ok: true });
}
