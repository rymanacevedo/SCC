import {
  type ClientActionFunction,
  type ClientActionFunctionArgs,
  data,
} from 'react-router';
import { z } from 'zod';
import { fieldErrors } from '../../../../shared/fieldErrors';
import { containsInappropriateWords } from '../../utils/filter';
import { proxySuggestions } from '../../utils/suggestions';

const formSchema = z.object({
  jobSearch: z.string(),
});

export const clientAction: ClientActionFunction = async ({
  request,
}: ClientActionFunctionArgs) => {
  const cloneData = request.clone();
  const formData = await cloneData.formData();
  const entries = Object.fromEntries(formData.entries());

  let result: z.infer<typeof formSchema>;

  try {
    result = formSchema.parse(entries);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return data({ errors: fieldErrors(error) }, { status: 400 });
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
    return proxySuggestions('/api/summaries', result.jobSearch);
  }
  return Response.json({});
};
