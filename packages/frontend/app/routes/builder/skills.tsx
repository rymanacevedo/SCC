import { redirect } from 'react-router';
import { Form, useActionData } from 'react-router';
import { z } from 'zod';
import type { Route } from '../../../.react-router/types/app/+types/root';
import { useState } from 'react';
import Button from '../../components/Button';
import Heading from '../../components/Heading';

const SkillsSchema = z.object({
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
  const actionData = useActionData<typeof clientAction>();
  const [userSkills, setUserSkills] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const handleAddSkill = (skill: string) => {
    if (!userSkills.includes(skill)) {
      setUserSkills([...userSkills, skill]);
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setUserSkills(userSkills.filter((skill) => skill !== skillToRemove));
  };

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
          <div className="mb-6">
            <label
              htmlFor="jobSearch"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Search by Job Title for Pre-Written Examples
            </label>
            <div className="relative">
              <input
                type="text"
                id="jobSearch"
                className="w-full border shadow-sm pl-10 pr-4 py-2 rounded-md"
                placeholder="e.g., Software Engineer, Project Manager"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                <svg
                  role="img"
                  aria-label="plus sign"
                  className="h-5 w-5 text-gray-400"
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
              </div>
            </div>
          </div>

          {/* Example Skills Based on Search */}
          <div className="bg-gray-50 p-4 rounded-md">
            <h3 className="font-medium text-gray-900 mb-3">Suggested Skills</h3>
            <div className="space-y-2">
              {/* This would be populated based on search results */}
              {['JavaScript', 'React', 'Node.js', 'TypeScript'].map((skill) => (
                <button
                  type="button"
                  key={skill}
                  onClick={() => handleAddSkill(skill)}
                  className="block w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 
                    transition-colors text-sm"
                >
                  + {skill}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - User's Skills */}
        <div>
          <Form method="post" className="space-y-6">
            <div>
              <h3 className="block text-sm font-medium text-gray-700 mb-2">
                Your Skills
              </h3>

              {/* User's Selected Skills */}
              <div className="min-h-[200px] bg-white border rounded-md p-4">
                {userSkills.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    No skills added yet. Search and add skills from the left, or
                    manually add them below.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {userSkills.map((skill, index) => (
                      <div
                        key={skill}
                        className="group flex items-center bg-blue-50 text-blue-700 
                          px-3 py-1 rounded-full text-sm"
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => handleRemoveSkill(skill)}
                          className="ml-2 text-blue-400 hover:text-blue-600"
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

            {/* Hidden inputs to submit all skills */}
            {userSkills.map((skill) => (
              <input key={skill} type="hidden" name="skills" value={skill} />
            ))}

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
