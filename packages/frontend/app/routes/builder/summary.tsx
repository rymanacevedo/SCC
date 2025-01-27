import { redirect } from 'react-router';
import { Form, useActionData } from 'react-router';
import { z } from 'zod';
import type { Route } from '../../../.react-router/types/app/+types/root';

const SummarySchema = z.object({
  summary: z.string().min(50, 'Summary should be at least 50 characters'),
});

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const data = Object.fromEntries(formData);

  try {
    // const validatedData = SummarySchema.parse(data);
    return redirect('/finish-up');
  } catch (error) {
    if (error instanceof z.ZodError) {
      // return json({ success: false, errors: error.flatten().fieldErrors });
    }
  }
}

export default function Summary() {
  const actionData = useActionData<typeof clientAction>();

  // Example summaries based on different professions
  const exampleSummaries = [
    {
      title: 'Software Developer',
      text: 'Results-driven software developer with 5 years of experience building web applications. Proficient in JavaScript, React, and Node.js. Strong problem-solving abilities and experience working in agile environments.',
    },
    {
      title: 'Project Manager',
      text: 'Certified project manager with proven track record of delivering complex projects on time and within budget. Skilled in stakeholder management and agile methodologies.',
    },
    {
      title: 'Marketing Specialist',
      text: 'Creative marketing professional with expertise in digital marketing campaigns and social media strategy. Track record of increasing engagement and driving conversion rates.',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Create Your Professional Summary
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Write a compelling summary that highlights your key achievements and
          career goals. This is often the first thing employers read.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column - Writing Area */}
        <div>
          <Form method="post" className="space-y-6">
            <div>
              <label
                htmlFor="summary"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Professional Summary
              </label>
              <textarea
                id="summary"
                name="summary"
                rows={8}
                className="w-full border rounded-md shadow-sm p-3"
                placeholder="Write a professional summary that highlights your key skills and experience..."
              />
              <p className="mt-2 text-sm text-gray-500">
                Aim for 3-5 sentences that capture your strongest
                qualifications.
              </p>
            </div>

            {/* Tips */}
            <div className="bg-blue-50 p-4 rounded-md">
              <h3 className="font-medium text-blue-800 mb-2">Writing Tips</h3>
              <ul className="text-sm text-blue-700 space-y-2">
                <li>
                  • Start with your professional title and years of experience
                </li>
                <li>• Highlight 2-3 key achievements or skills</li>
                <li>• Mention your career goals or what you're looking for</li>
                <li>• Keep it concise and focused</li>
              </ul>
            </div>

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

        {/* Right Column - Examples */}
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Example Summaries
          </h2>
          <div className="space-y-4">
            {exampleSummaries.map((example) => (
              <div
                key={example.text}
                className="bg-gray-50 p-4 rounded-md cursor-pointer 
                  hover:bg-gray-100 transition-colors"
              >
                <h3 className="font-medium text-gray-900 mb-2">
                  {example.title}
                </h3>
                <p className="text-sm text-gray-600">{example.text}</p>
                <button
                  type="button"
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                  onClick={() => {
                    const textarea = document.getElementById(
                      'summary',
                    ) as HTMLTextAreaElement;
                    if (textarea) {
                      textarea.value = example.text;
                    }
                  }}
                >
                  Use this example
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
