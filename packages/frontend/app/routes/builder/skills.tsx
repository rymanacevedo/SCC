import {
  type ClientLoaderFunctionArgs,
  data,
  redirect,
  useActionData,
  useFetcher,
  useLoaderData,
} from 'react-router';
import { Form } from 'react-router';
import { z } from 'zod';
import type { Route } from '../../../.react-router/types/app/+types/root';
import { useCallback, useState } from 'react';
import Button from '../../components/Button';
import Heading from '../../components/Heading';
import { getUser, updateUser } from '../../utils/user';
import type { FormErrors } from '../../components/Input';
import useEffectOnce from '../../hooks/useEffectOnce';
import Loading from '../../components/Loading';
import Main from '../../components/Main';
import { HeadingWithSubHeading } from '../../components/HeadingWithSubHeading';

export const SkillsSchema = z.object({
  expertRecommended: z.array(z.string()),
  other: z.array(z.string()),
});

export type TSkills = z.infer<typeof SkillsSchema>;

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const expertRecommended = formData.getAll('expertRecommended');
  const other = formData.getAll('other');
  const constructedObject = {
    expertRecommended,
    other,
  };

  const url = new URL(request.url);
  const returnUrl = url.searchParams.get('returnUrl');
  const redirectUrl = returnUrl ? returnUrl : '/summary';
  try {
    const validatedData = SkillsSchema.parse(constructedObject);
    updateUser('skills', validatedData);
    return redirect(redirectUrl);
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
}

// TODO: HOTFIX see github issue https://github.com/remix-run/react-router/issues/12607
let cachedClientLoader: undefined | any;

// export function shouldRevalidate(args: ShouldRevalidateFunctionArgs) {
//   const { actionResult } = args;
//   if (actionResult.init.status !== 302) {
//     cachedClientLoader = undefined;
//   }
//   return false;
// }

export async function clientLoader({ request }: ClientLoaderFunctionArgs) {
  // if (cachedClientLoader) return cachedClientLoader;
  const user = getUser();
  const url = new URL(request.url);
  const returnUrl = url.searchParams.get('returnUrl');

  const firstJobTitle = user?.experience[0].jobTitle!;

  cachedClientLoader = {
    prevSkills: user?.skills,
    firstJobTitle,
    returnUrl,
  };
  return Response.json(cachedClientLoader);
}

// Force the client loader to run during hydration
clientLoader.hydrate = true as const;

export default function Skills() {
  const { prevSkills, firstJobTitle, returnUrl } =
    useLoaderData<typeof clientLoader>();
  const fetcher = useFetcher<TSkills>();
  const MAX_SKILLS = 6 as const;
  const actionData = useActionData<typeof clientAction>();
  const [userSkills, setUserSkills] = useState<TSkills>(
    prevSkills || {
      expertRecommended: [],
      other: [],
    },
  );

  const totalSkills =
    userSkills.expertRecommended.length + userSkills.other.length;
  const remainingSkills = MAX_SKILLS - totalSkills;

  const handleAddSkill = useCallback(
    (skill: string, skillKey: keyof TSkills) => {
      const skillExists = userSkills[skillKey].includes(skill);
      const totalSkills =
        userSkills.expertRecommended.length + userSkills.other.length;

      if (!skillExists && totalSkills < MAX_SKILLS) {
        setUserSkills((prev) => ({
          ...prev,
          [skillKey]: [...prev[skillKey], skill],
        }));
      }
    },
    [userSkills, MAX_SKILLS],
  );

  const handleRemoveSkill = useCallback((skillToRemove: string) => {
    setUserSkills((prev) => ({
      expertRecommended: prev.expertRecommended.filter(
        (skill) => skill !== skillToRemove,
      ),
      other: prev.other.filter((skill) => skill !== skillToRemove),
    }));
  }, []);

  useEffectOnce(() => {
    if (fetcher.state === 'idle' && !fetcher.data) {
      const formData = new FormData();
      formData.set('jobSearch', firstJobTitle || '');
      fetcher.submit(formData, {
        method: 'POST',
        action: '/api/skills',
      });
    }
  });

  return (
    <Main>
      <HeadingWithSubHeading
        firstHeading="What skills would you like to highlight?"
        secondHeading="Add skills that are relevant to your experience and the job you want."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column - Search and Suggestions */}
        <div>
          {/* A/B Test this */}
          {/* <fetcher.Form
            action="/api/skills"
            method="post"
            className="inline-flex gap-2 w-full"
          >
            <Input
              type="text"
              label="Search by Job Title for Pre-Written Examples"
              id="jobSearch"
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
          </fetcher.Form> 
          */}

          {/* Example Skills Based on Search */}
          <div className="p-4 rounded-md">
            <Heading
              level="h3"
              text="Suggested Skills"
              size="text-base"
              classNames="mb-3"
            />
            <div className="space-y-2 border rounded-md p-4">
              <Heading
                level="h3"
                text="Expert Skills"
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
                ).map((skill) => (
                  <Button
                    key={skill}
                    type="custom"
                    callback={() => handleAddSkill(skill, 'expertRecommended')}
                    text={`+ ${skill}`}
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
                text="Other Skills"
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
                ).map((skill) => (
                  <Button
                    key={skill}
                    type="custom"
                    callback={() => handleAddSkill(skill, 'other')}
                    text={`+ ${skill}`}
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

        {/* Right Column - User's Skills */}
        <div>
          <Heading
            level="h3"
            text="Your Skills"
            size="text-sm"
            classNames="mb-2"
          />
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {remainingSkills} of {MAX_SKILLS} remaining
          </p>

          <Form method="post" className="space-y-6">
            {/* User's Selected Skills */}
            <div className="min-h-[200px] border rounded-md p-4">
              {userSkills.expertRecommended.length === 0 &&
              userSkills.other.length === 0 ? (
                <p className="text-sm">
                  No skills added yet. Search and add skills from the left, or
                  manually add them below.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {[...userSkills.expertRecommended, ...userSkills.other].map(
                    (skill) => {
                      const category = userSkills.expertRecommended.includes(
                        skill,
                      )
                        ? 'expertRecommended'
                        : 'other';

                      return (
                        <div
                          key={skill}
                          className="group flex items-center bg-blue-50 text-blue-700 
                px-3 py-1 rounded-full text-sm"
                        >
                          {skill}
                          <Button
                            type="custom"
                            action="button"
                            callback={() => handleRemoveSkill(skill)}
                            classNames="ml-2 text-blue-400 hover:text-blue-600 cursor-pointer"
                            text="×"
                          />
                          <input
                            key={skill}
                            type="hidden"
                            name={category}
                            value={skill}
                          />
                        </div>
                      );
                    },
                  )}
                </div>
              )}
            </div>

            {/* Manual Skill Input */}
            <div className="mt-4">
              <input
                type="text"
                className="w-full border shadow-sm pl-2 py-2 rounded-md"
                placeholder="Type a skill and press Enter"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const input = e.target as HTMLInputElement;
                    if (input.value.trim()) {
                      handleAddSkill(input.value.trim(), 'other');
                      input.value = '';
                    }
                  }
                }}
              />
            </div>
            {/* Navigation Buttons */}
            <div className="flex justify-between pt-4">
              {returnUrl ? (
                <Button action="submit" text="Resubmit" />
              ) : (
                <>
                  <Button
                    text="Previous"
                    type="secondary"
                    action="button"
                    callback={() => window.history.back()}
                  />
                  <Button action="submit" text="Next Step" />
                </>
              )}
            </div>
          </Form>
        </div>
      </div>
    </Main>
  );
}
