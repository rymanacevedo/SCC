import {
  data,
  Form,
  redirect,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigate,
} from 'react-router';
import Button from '../../components/Button';
import Heading from '../../components/Heading';
import Loading from '../../components/Loading';
import { useCallback, useState } from 'react';
import type { FormErrors } from '../../components/Input';
import type { Route } from '../../../.react-router/types/app/+types/root';
import { z } from 'zod';
import type { TExperience } from '../api/experienceEntry';
import {
  getExperienceDetails,
  getQueuedExperience,
  setQueuedExperience,
  updateUser,
} from '../../utils/user';
import useEffectOnce from '../../hooks/useEffectOnce';
import { addQueryParams } from '../../utils/navigation';
import type { ActionData } from '../../models/Actions';
import Main from '../../components/Main';
import { HeadingWithSubHeading } from '../../components/HeadingWithSubHeading';

const ExperienceEntrySchema = z.object({
  jobId: z.string(),
  jobDetails: z
    .array(z.string())
    .min(2, 'Please add at least 2 examples of experience.'),
});

function transformExperienceDetails(obj: {
  [k: string]: FormDataEntryValue;
}) {
  const jobDetails: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('experience-')) {
      jobDetails.push(value as string);
    }
  }
  return {
    jobId: obj.jobId,
    jobDetails,
  };
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const entries = Object.fromEntries(formData);
  const url = new URL(request.url);
  const returnUrl = url.searchParams.get('returnUrl');

  const redirectUrl = addQueryParams('/experience-summary', {
    jobId: entries.jobId as string,
    returnUrl,
  });
  const formattedData = transformExperienceDetails(entries);
  try {
    const validatedData = ExperienceEntrySchema.parse(formattedData);
    // hot fix to get details without storing in form
    const exp = getQueuedExperience();
    if (exp) {
      exp.details = [...validatedData.jobDetails];
      updateUser('experience', exp);
      return redirect(redirectUrl);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
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
  }
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get('jobId');
  const exp = getQueuedExperience();

  // we prefer the experience in the queue first over the jobId
  if (exp) {
    return data(exp);
  }

  // Only fall back to getting experience details if no queued experience
  if (jobId) {
    const storedExperience = getExperienceDetails(jobId);
    if (!storedExperience) {
      return redirect('/experience');
    }
    setQueuedExperience(storedExperience);
    return data(storedExperience);
  }
  return redirect('/experience');
}

export default function ExperienceEntry() {
  const fetcher = useFetcher<TExperience>();
  // const errors: any = fetcher.data?.data?.errors;
  const action = useActionData<typeof clientAction>();
  const errors = action?.errors;
  const navigate = useNavigate();
  const { details, jobTitle, jobId, employer } =
    useLoaderData<typeof clientLoader>();
  const [userExperience, setUserExperience] = useState<string[]>(details || []);

  useEffectOnce(() => {
    if (fetcher.state === 'idle' && !fetcher.data) {
      const formData = new FormData();
      formData.set('jobTitleSearch', jobTitle || '');
      formData.set('employer', employer || '');
      fetcher.submit(formData, {
        method: 'POST',
        action: '/api/experienceEntry',
      });
    }
  });

  const handleAddExperience = useCallback(
    (experience: string) => {
      if (userExperience.length >= 6) {
        alert('Maximum of 6 examples allowed.');
        return;
      }
      if (!userExperience.includes(experience)) {
        setUserExperience([...userExperience, experience]);
      }
    },
    [userExperience],
  );

  const handleRemoveExperience = useCallback(
    (experienceToRemove: string) => {
      setUserExperience(
        userExperience.filter(
          (experience) => experience !== experienceToRemove,
        ),
      );
    },
    [userExperience],
  );

  const startsWithVowel = (word: string | undefined) => {
    if (!word || word.length === 0) return false;
    const vowels = ['a', 'e', 'i', 'o', 'u'];
    return vowels.includes(word[0].toLowerCase());
  };

  return (
    <Main>
      <HeadingWithSubHeading
        firstHeading={
          startsWithVowel(jobTitle)
            ? `What did you do as an ${jobTitle}?`
            : `What did you do as a ${jobTitle}?`
        }
        secondHeading="Choose from our pre-written examples below or write your own."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column - Writing Area */}
        <div>
          {/* TODO: A/B test this */}
          {/* <fetcher.Form
            action="/api/experienceEntry"
            method="post"
            className="inline-flex w-100 gap-2"
          >
            <Input
              type="text"
              label="Search by Job Title for Pre-Written Examples"
              id="jobTitleSearch"
              error={errors}
            />

            <div className="flex items-center">
              <Button
                textSize="text-xs"
                type="icon"
                text="Search"
                disabled={fetcher.state !== 'idle'}
                icon={
                  // Search icon
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                }
                action="submit"
              />
            </div>
          </fetcher.Form> */}
          <div className="p-4 rounded-md">
            <Heading
              level="h3"
              text="Suggested Experience"
              size="text-base"
              classNames="mb-3"
            />

            <div className="space-y-2 border rounded-md p-4">
              <Heading
                level="h3"
                text="Recommended Experience"
                size="text-sm"
                classNames="mb-3"
              />
              <Loading fetcher={fetcher}>
                {(
                  fetcher.data?.expertRecommended || [
                    'Microsoft Office',
                    'Collaboration',
                    'Decision-making',
                    'Organization skills',
                    'Public Speaking',
                  ]
                ).map((experience, index) => (
                  <Button
                    callback={() => handleAddExperience(experience)}
                    key={`${experience}-${index}`}
                    type="custom"
                    text={`+ ${experience}`}
                    textSize="text-sm"
                    action="button"
                    classNames="
                          w-full text-left
                          dark:hover:bg-gray-800
                          py-2 px-4
                          hover:bg-gray-200
                          text-gray-800
                          dark:text-gray-300
                          rounded-md border
                          transition-colors
                          "
                  />
                ))}
              </Loading>
              <Heading
                level="h4"
                text="Other Examples"
                size="text-sm"
                classNames="mb-3"
              />
              <Loading fetcher={fetcher}>
                {(
                  fetcher.data?.other || [
                    'Time Management',
                    'Communication',
                    'Problem Solving',
                    'Leadership',
                    'Active Listening',
                  ]
                ).map((experience, index) => (
                  <Button
                    callback={() => handleAddExperience(experience)}
                    key={`${experience}-${index}`}
                    type="custom"
                    text={`+ ${experience}`}
                    textSize="text-sm"
                    action="button"
                    classNames="
                          w-full text-left
                          dark:hover:bg-gray-800
                          py-2 px-4
                          hover:bg-gray-200
                          text-gray-800
                          dark:text-gray-300
                          rounded-md border
                          transition-colors
                          "
                  />
                ))}
              </Loading>
            </div>
          </div>
        </div>

        {/* Right Column - Examples */}
        <div>
          {/* Tips */}
          <div className="bg-blue-50 p-4 rounded-md">
            <Heading
              text="Writing Tips"
              level="h2"
              size="text-base"
              color="text-blue-800"
              classNames="mb-2 font-medium"
            />
            <ul className="text-sm text-blue-700 space-y-2">
              <li>Highlight 2-3 key achievements.</li>
              <li>Mention your career goals or what you're looking for.</li>
              <li>Keep it concise and focused.</li>
            </ul>
          </div>
          <div className="space-y-6">
            <Heading
              level="h2"
              size="text-sm"
              text="Job Experience"
              classNames="font-medium mb-2 mt-2"
            />
            {/* Navigation Buttons */}
            <Form method="post">
              <div className="border rounded-md shadow-sm p-3">
                {userExperience.length === 0 ? (
                  <p className="text-sm text-gray-500 p-2">
                    Click on suggested experiences or write your own to get
                    started.
                  </p>
                ) : (
                  userExperience.map((experience, index) => (
                    <div
                      key={`experience-${index}`}
                      className="flex items-center gap-2 mb-2"
                    >
                      <Button
                        text={`Remove ${experience}`}
                        icon={
                          <svg
                            className="fill-gray-900 dark:fill-white cursor-pointer"
                            height="10px"
                            width="10px"
                            version="1.1"
                            id={`remove-experience-${index}`}
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 460.775 460.775"
                          >
                            <title>{`Remove ${experience}`}</title>
                            <g id="SVGRepo_bgCarrier" strokeWidth="0" />
                            <g
                              id="SVGRepo_tracerCarrier"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <g id="SVGRepo_iconCarrier">
                              <path d="M285.08,230.397L456.218,59.27c6.076-6.077,6.076-15.911,0-21.986L423.511,4.565c-2.913-2.911-6.866-4.55-10.992-4.55 c-4.127,0-8.08,1.639-10.993,4.55l-171.138,171.14L59.25,4.565c-2.913-2.911-6.866-4.55-10.993-4.55 c-4.126,0-8.08,1.639-10.992,4.55L4.558,37.284c-6.077,6.075-6.077,15.909,0,21.986l171.138,171.128L4.575,401.505 c-6.074,6.077-6.074,15.911,0,21.986l32.709,32.719c2.911,2.911,6.865,4.55,10.992,4.55c4.127,0,8.08-1.639,10.994-4.55 l171.117-171.12l171.118,171.12c2.913,2.911,6.866,4.55,10.993,4.55c4.128,0,8.081-1.639,10.992-4.55l32.709-32.719 c6.074-6.075,6.074-15.909,0-21.986L285.08,230.397z" />
                            </g>
                          </svg>
                        }
                        type="iconCustom"
                        action="button"
                        callback={() => handleRemoveExperience(experience)}
                      />
                      <textarea
                        className="w-full border-0 field-sizing-content"
                        wrap="soft"
                        name={`experience-${index}`}
                        id={`experience-${index}`}
                        value={experience}
                        onChange={(e) => {
                          const newExperiences = [...userExperience];
                          newExperiences[index] = e.target.value;
                          setUserExperience(newExperiences);
                        }}
                      />
                    </div>
                  ))
                )}
              </div>
              {errors && 'jobDetails' in errors ? (
                <p className="mt-1 text-sm text-red-600">
                  {(errors as any).jobDetails[0]}
                </p>
              ) : null}
              {/* Manual Experience Input */}
              <div className="mt-4">
                {userExperience.length >= 6 ? (
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    Maximum number of experiences reached (6)
                  </p>
                ) : (
                  <input
                    type="text"
                    className="w-full border shadow-sm pl-2 py-2 rounded-md"
                    placeholder="Type your experience and press Enter"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const input = e.target as HTMLInputElement;
                        if (input.value.trim()) {
                          handleAddExperience(input.value.trim());
                          input.value = '';
                        }
                      }
                    }}
                  />
                )}
              </div>
              <div className="flex justify-between mt-3">
                <input type="hidden" name="jobId" id="jobId" value={jobId} />
                <Button
                  type="secondary"
                  text="Previous"
                  action="button"
                  callback={() =>
                    navigate(`/experience?jobId=${encodeURIComponent(jobId)}`)
                  }
                />
                <Button action="submit" text="Next Step" />
              </div>
            </Form>

            <p className="mb-3 mt-3 text-sm dark:text-gray-400 text-gray-600">
              Aim for 3-6 bullets that capture your experience at the role.
            </p>
          </div>
        </div>
      </div>
    </Main>
  );
}
