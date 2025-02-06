import type {
  ClientActionFunction,
  ClientActionFunctionArgs,
} from 'react-router';
import { z } from 'zod';

const formSchema = z.object({
  jobTitleSearch: z.string(),
});

export const JobTitleSchema = z.object({
  expertRecommended: z.array(z.string()),
  other: z.array(z.string()),
});

export type TExperience = z.infer<typeof JobTitleSchema>;

export const clientAction: ClientActionFunction = async ({
  request,
}: ClientActionFunctionArgs) => {
  const cloneData = request.clone();
  const formData = await cloneData.formData();
  const fields = Object.fromEntries(formData.entries());
  const result = formSchema.parse(fields);

  let experience = {
    expertRecommended: [
      'Tracked test reports and failures determined by root cause data trends.',
      'Created comprehensive test plans, test scripts, and use cases to support testing objectives.',
      'Reviewed, evaluated, and identified requirements for testability.',
      'Developed and maintained relationships with suppliers to facilitate quality and timely delivery of materials.',
    ],
    other: [
      'Developed and implemented procedures to verify compliance with engineering standards.',
      'Documented and developed engineering procedures and processes.',
      'Trained and mentored junior engineers, providing guidance and direction.',
      'Monitored and evaluated engineering performance to recommend improvements.',
    ],
  };

  console.log(result.jobTitleSearch);

  if (result.jobTitleSearch) {
    // TODO: API call for job search
    const finalResult = JobTitleSchema.parse(experience);
    console.log(finalResult);
    return Response.json(finalResult);
  }

  return Response.json(experience);
};
