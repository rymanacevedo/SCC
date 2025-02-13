import { redirect, useFetcher, useLoaderData } from 'react-router';
import { Form } from 'react-router';
import { z } from 'zod';
import type { Route } from '../../../.react-router/types/app/+types/root';
import { useCallback, useState } from 'react';
import Button from '../../components/Button';
import Heading from '../../components/Heading';
import { createSkills } from '../../utils/aiServices';
import { getUser } from '../../utils/user';
import { containsInappropriateWords } from '../../utils/filter';
export const SkillsSchema = z.object({
  expertRecommended: z.array(z.string()),
  other: z.array(z.string()),
});

export type TSkills = z.infer<typeof SkillsSchema>;

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const data = Object.fromEntries(formData);

  try {
    // const validatedData = SkillsSchema.parse({
    //   skills: formData.getAll('skills'),
    // });
    return redirect('/summary');
  } catch (error) {
    if (error instanceof z.ZodError) {
      // return json({ success: false, errors: error.flatten().fieldErrors });
    }
  }
}

export async function clientLoader() {
  const user = getUser();
  let skills = {
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
  };

  // TODO: get rid of null assertion
  const badWord = containsInappropriateWords(user?.experience!);

  if (badWord) {
    return Response.json(
      { error: `The term "${badWord}" is not allowed.` },
      { status: 400 },
    );
  }

  if (user?.experience) {
    // TODO: batch job the jobs and give the model more "details"
    const firstJob = user.experience[0].jobTitle;
    // TODO: get rid of null assertion
    skills = await createSkills(firstJob!);
    const finalResult = SkillsSchema.parse(skills);

    return Response.json(finalResult);
  }
  return Response.json(skills);
}

// Force the client loader to run during hydration
clientLoader.hydrate = true as const;

export default function Skills() {
  const loaderData = useLoaderData<TSkills>();
  // const errors: any = fetcher.data?.data?.errors;
  const [userSkills, setUserSkills] = useState<string[]>([]);

  const handleAddSkill = useCallback(
    (skill: string) => {
      if (!userSkills.includes(skill)) {
        setUserSkills([...userSkills, skill]);
      }
    },
    [userSkills],
  );

  const handleRemoveSkill = useCallback(
    (skillToRemove: string) => {
      setUserSkills(userSkills.filter((skill) => skill !== skillToRemove));
    },
    [userSkills],
  );

  return (
    <main className="max-w-6xl mx-auto">
      <div className="mb-8">
        <Heading
          level="h1"
          size="text-2xl"
          text="What skills would you like to highlight?"
          bold={true}
          classNames="mb-2"
        />
        <Heading
          level="h2"
          size="text-sm"
          text="Add skills that are relevant to your experience and the job you want."
          color="dark:text-gray-400 text-gray-600"
        />
      </div>

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
              {(
                loaderData.expertRecommended || [
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
                  callback={() => handleAddSkill(skill)}
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
              <Heading
                level="h4"
                text="Other Skills"
                size="text-sm"
                classNames="mb-3"
              />
              {(
                loaderData.other || [
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
                  callback={() => handleAddSkill(skill)}
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
            </div>
          </div>
        </div>

        {/* Right Column - User's Skills */}
        <div>
          <Form method="post" className="space-y-6">
            <div>
              <Heading
                level="h3"
                text="Your Skills"
                size="text-sm"
                classNames="mb-2"
              />

              {/* User's Selected Skills */}
              <div className="min-h-[200px]  border rounded-md p-4">
                {userSkills.length === 0 ? (
                  <p className="text-sm">
                    No skills added yet. Search and add skills from the left, or
                    manually add them below.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {userSkills.map((skill) => (
                      <div
                        key={skill}
                        className="group flex items-center bg-blue-50 text-blue-700 
                          px-3 py-1 rounded-full text-sm"
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(skill)}
                          className="ml-2 text-blue-400 hover:text-blue-600 cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    ))}
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
                        handleAddSkill(input.value.trim());
                        input.value = '';
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* Hidden inputs to submit all skills
            {userSkills.map((skill) => (
              <input key={skill} type="hidden" name="skills" value={skill} />
            ))} */}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-4">
              <Button
                text="Previous"
                type="secondary"
                action="button"
                callback={() => window.history.back()}
              />

              <Button action="submit" text="Next Step" />
            </div>
          </Form>
        </div>
      </div>
    </main>
  );
}
