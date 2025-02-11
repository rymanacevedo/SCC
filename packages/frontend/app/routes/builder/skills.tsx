import { redirect, useFetcher } from 'react-router';
import { Form, useActionData } from 'react-router';
import { z } from 'zod';
import type { Route } from '../../../.react-router/types/app/+types/root';
import { useCallback, useState } from 'react';
import Button from '../../components/Button';
import Heading from '../../components/Heading';
import Input from '../../components/Input';
import type { TSkills } from '../api/skills';
import Loading from '../../components/Loading';

export const SkillsSchema = z.object({
  skills: z.array(z.string()).min(1, 'At least one skill is required'),
});

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

export default function Skills() {
  const fetcher = useFetcher<TSkills>();

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
          <fetcher.Form
            action="/api/skills"
            method="post"
            className="inline-flex gap-2 w-full"
          >
            {/* TODO: adjust the size */}
            <Input
              type="text"
              label="Search by Job Title for Pre-Written Examples"
              id="jobSearch"
            />
            <div className="flex items-center">
              <Button
                textSize="text-xs"
                type="icon"
                text="Search"
                icon={
                  fetcher.state !== 'idle' ? (
                    <svg
                      aria-hidden="true"
                      className="h-5 w-5 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  ) : (
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
                  )
                }
                action="submit"
              />
            </div>
          </fetcher.Form>

          {/* Example Skills Based on Search */}
          <div className="p-4 rounded-md">
            <Heading
              level="h3"
              text="Suggested Skills"
              size="text-base"
              classNames="mb-3"
            />
            <div className="space-y-2 border rounded-md p-4">
              {/* This would be populated based on search results */}
              <Heading
                level="h3"
                text="Expert Skills"
                size="text-sm"
                classNames="mb-3"
              />
              <Loading fetcher={fetcher}>
                {(
                  fetcher.data?.skills.expertRecommended || [
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
              </Loading>
              <Heading
                level="h4"
                text="Other Skills"
                size="text-sm"
                classNames="mb-3"
              />
              <Loading fetcher={fetcher}>
                {(
                  fetcher.data?.skills.other || [
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
              </Loading>
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
