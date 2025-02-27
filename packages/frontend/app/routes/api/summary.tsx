import {
  type ClientActionFunction,
  type ClientActionFunctionArgs,
  data,
} from 'react-router';
import { containsInappropriateWords } from '../../utils/filter';
import { z } from 'zod';
import type { FormErrors } from '../../components/Input';

const formSchema = z.object({
  jobSearch: z.string(),
});

export const clientAction: ClientActionFunction = async ({
  request,
}: ClientActionFunctionArgs) => {
  const cloneData = request.clone();
  const formData = await cloneData.formData();
  const entries = Object.fromEntries(formData.entries());

  let result: any;

  try {
    result = formSchema.parse(entries);
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

  const badWord = containsInappropriateWords(result);

  if (badWord) {
    return Response.json(
      { error: `The term "${badWord}" is not allowed.` },
      { status: 400 },
    );
  }

  if (result.jobSearch) {
    const bckEndUrl = `${import.meta.env.VITE_HONO_BACKEND_URL}/api/generate`;
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
    const summaries = await res.json();
    return Response.json(summaries);
  }
  return Response.json({});
};
