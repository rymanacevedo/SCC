import type {
  ClientActionFunction,
  ClientActionFunctionArgs,
} from 'react-router';
import { z } from 'zod';
import { createExperience } from '../../utils/aiServices';
import { Filter } from 'bad-words';

const formSchema = z.object({
  jobTitleSearch: z.string(),
});

export const JobTitleSchema = z.object({
  expertRecommended: z.array(z.string()),
  other: z.array(z.string()),
});

const filter = new Filter();

export type TExperience = z.infer<typeof JobTitleSchema>;
const blacklist = [
  'Sex Worker',
  'Porn Star',
  'Adult Film',
  'Escort',
  'Cam Model',
  'Stripper',
  'Exotic Dancer',
  'Erotic Dancer',
  'Pornographic Content Creator',
  'Explicit Performer',
  'Performer of Explicit Content',
  'Shit Talker',
  'OnlyFans',
  'Fansly',
  'Porn Addict',
  'Terrorist',
  'Extremist',
  'Jihadist',
  'Bomber',
  'Assassin',
  'Violent Extremist',
  'Hate Crime Inciter',
  'Radicalizer',
  'Domestic Terrorist',
];

filter.addWords(...blacklist);

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
  const result = formSchema.parse(fields);

  const badWord = containsInappropriateWords(result.jobTitleSearch);
  if (badWord) {
    return Response.json(
      { error: `The term "${badWord}" is not allowed.` },
      { status: 400 },
    );
  }

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

  if (result.jobTitleSearch) {
    experience = await createExperience(result.jobTitleSearch);
    const finalResult = JobTitleSchema.parse(experience);
    return Response.json(finalResult);
  }

  return Response.json(experience);
};
