import {
  type ClientActionFunction,
  type ClientActionFunctionArgs,
  data,
} from 'react-router';
import { containsInappropriateWords } from '../../utils/filter';
import { z } from 'zod';
import type { FormErrors } from '../../components/Input';
import { createSummaries } from '../../utils/aiServices';

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
    const summaries = await createSummaries(result.jobSearch);
    return Response.json(summaries);
  }
  return Response.json({});
};
