import {
  type ClientActionFunctionArgs,
  Form,
  redirect,
  useFetcher,
  useLoaderData,
} from 'react-router';
import Button from '../../components/Button';
import Heading from '../../components/Heading';
import { useState } from 'react';
import Input from '../../components/Input';
import type { Route } from '../../../.react-router/types/app/+types/root';
import { z } from 'zod';
import type { TExperience } from '../api/experienceEntry';
import { getRequiredUserTrait } from '../../utils/user';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const data = Object.fromEntries(formData);

  try {
    // const validatedData = SkillsSchema.parse({
    //   skills: formData.getAll('skills'),
    // });
    return redirect('/education');
  } catch (error) {
    if (error instanceof z.ZodError) {
      // return json({ success: false, errors: error.flatten().fieldErrors });
    }
  }
}

export async function clientLoader() {
  const { jobTitle } = getRequiredUserTrait('experience');
  // return results from an api call as well for what the jobtitle experience
  return {
    jobTitle,
  };
}

export default function ExperienceEntry() {
  const fetcher = useFetcher<TExperience>();
  const { jobTitle } = useLoaderData<typeof clientLoader>();
  const [userExperience, setUserExperience] = useState<string[]>([]);

  const handleAddExperience = (experience: string) => {
    if (!userExperience.includes(experience)) {
      setUserExperience([...userExperience, experience]);
    }
  };

  const handleRemoveExperience = (experienceToRemove: string) => {
    setUserExperience(
      userExperience.filter((experience) => experience !== experienceToRemove),
    );
  };

  const handleUpdateExperience = (e: any, index: number) => {
    const updatedExperience = e.currentTarget.textContent || '';
    const newUserExperience = [...userExperience];
    newUserExperience[index] = updatedExperience;
    setUserExperience(newUserExperience);
  };

  const startsWithVowel = (word: string) => {
    if (!word || word.length === 0) return false;
    const vowels = ['a', 'e', 'i', 'o', 'u'];
    return vowels.includes(word[0].toLowerCase());
  };

  return (
    <main className="max-w-6xl mx-auto">
      <div className="mb-8">
        <Heading
          level="h1"
          size="text-2xl"
          // TODO: adjust the naming to be a prop
          text={
            startsWithVowel(jobTitle)
              ? `What did you do as an ${jobTitle}?`
              : `What did you do as a ${jobTitle}?`
          }
          bold={true}
          classNames="mb-2"
        />
        <Heading
          level="h2"
          size="text-sm"
          text="Choose from our pre-written examples below or write your own."
          color="dark:text-gray-400 text-gray-600"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column - Writing Area */}
        <div>
          <fetcher.Form
            action="/api/experienceEntry"
            method="post"
            className="inline-flex w-100 gap-2"
          >
            <Input
              type="text"
              label="Search by Job Title for Pre-Written Examples"
              id="jobTitleSearch"
            />

            <div className="flex items-center">
              <Button
                textSize="text-xs"
                type="icon"
                text="Search"
                icon={
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
          <div className="p-4 rounded-md">
            <Heading
              level="h3"
              text="Suggested Experience"
              size="text-base"
              classNames="mb-3"
            />
            <div className="space-y-2 border rounded-md p-4">
              {/* This would be populated based on search results */}
              <Heading
                level="h3"
                text="Recommended Experience"
                size="text-sm"
                classNames="mb-3"
              />
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
              <Heading
                level="h4"
                text="Other Examples"
                size="text-sm"
                classNames="mb-3"
              />
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
            </div>
          </div>
        </div>

        {/* Right Column - Examples */}
        <div>
          <div className="space-y-6">
            <Heading
              level="h2"
              size="text-sm"
              text="Job Description"
              classNames="font-medium mb-2"
            />
            <ul className="w-full border rounded-md shadow-sm pl-7 p-3 list-disc">
              {userExperience.map((experience, index) => (
                // TODO: contenteditable needs XSS sanitation
                <li
                  key={`${experience}-${index}`}
                  onBlur={(e) => handleUpdateExperience(e, index)}
                >
                  {experience}
                </li>
              ))}
            </ul>
            <p className="mb-3 mt-3 text-sm dark:text-gray-400 text-gray-600">
              Aim for 3-6 bullets that capture your experience at the role.
            </p>
          </div>

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
          {/* Navigation Buttons */}
          <Form method="post" className="flex justify-between pt-4">
            <Button
              type="secondary"
              text="Previous"
              action="button"
              callback={() => window.history.back()}
            />
            <Button action="submit" text="Next Step" />
          </Form>
        </div>
      </div>
    </main>
  );
}
