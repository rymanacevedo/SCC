import { redirect } from 'react-router';
import { Form, useActionData } from 'react-router';
import { z } from 'zod';
import type { Route } from '../../../.react-router/types/app/+types/root';
import { useState } from 'react';

const SkillsSchema = z.object({
  skills: z.array(z.string()).min(1, 'At least one skill is required'),
});

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const data = Object.fromEntries(formData);

  try {
    const validatedData = SkillsSchema.parse({
      skills: formData.getAll('skills'),
    });
    return redirect('/builder/preview');
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
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          What skills would you like to highlight?
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Add skills that are relevant to your experience and the job you want.
        </p>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Skills
              </label>

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
                        key={index}
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
                  className="w-full border shadow-sm rounded-md"
                  placeholder="Type a skill and press Enter"
                  onKeyPress={(e) => {
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
            {userSkills.map((skill, index) => (
              <input key={index} type="hidden" name="skills" value={skill} />
            ))}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="inline-flex justify-center rounded-md border border-gray-300 
                  bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm 
                  hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 
                  focus:ring-offset-2"
              >
                Previous
              </button>
              <button
                type="submit"
                className="inline-flex justify-center rounded-md border border-transparent 
                  bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm 
                  hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 
                  focus:ring-offset-2"
              >
                Next Step
              </button>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}
