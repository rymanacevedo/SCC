import { redirect } from 'react-router';
import { Form, useActionData } from 'react-router';
import { z } from 'zod';
import type { Route } from '../../../.react-router/types/app/+types/root';
import Button from '../../components/Button';
import Heading from '../../components/Heading';

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
    <main className="max-w-4xl mx-auto">
      <div className="mb-8">
        <Heading
          level="h1"
          size="text-2xl"
          text="Create Your Professional Summary"
          bold={true}
          classNames="mb-2"
        />
        <Heading
          level="h2"
          size="text-sm"
          text="Write a compelling summary that highlights your key achievements and
          career goals. This is often the first thing employers read."
          color="dark:text-gray-400 text-gray-600"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column - Writing Area */}
        <div>
          <Form method="post" className="space-y-6">
            <div>
              <label
                htmlFor="summary"
                className="block text-sm font-medium dark:text-white text-gray-700 mb-2"
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
              <p className="mt-2 text-sm dark:text-gray-400 text-gray-600">
                Aim for 3-5 sentences that capture your strongest
                qualifications.
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
                <li>
                  Start with your professional title and years of experience
                </li>
                <li>Highlight 2-3 key achievements or skills</li>
                <li>Mention your career goals or what you're looking for</li>
                <li>Keep it concise and focused</li>
              </ul>
            </div>
          </Form>
        </div>

        {/* Right Column - Examples */}
        <div>
          <Heading
            text="Example Summaries"
            level="h2"
            size="text-lg"
            classNames="mb-4"
          />
          <div className="space-y-4">
            {exampleSummaries.map((example) => (
              <button
                type="button"
                key={example.text}
                className="text-left border p-4 rounded-md cursor-pointer 
                  hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => {
                  const textarea = document.getElementById(
                    'summary',
                  ) as HTMLTextAreaElement;
                  if (textarea) {
                    textarea.value = example.text;
                  }
                }}
              >
                <Heading
                  text={example.title}
                  level="h3"
                  size="text-base"
                  classNames="mb-2"
                />
                <p className="text-sm dark:text-gray-400 text-gray-600">
                  {example.text}
                </p>
              </button>
            ))}
          </div>
          {/* Navigation Buttons */}
          <div className="flex justify-between pt-4">
            <Button
              type="secondary"
              text="Previous"
              action="button"
              callback={() => window.history.back()}
            />
            <Button action="submit" text="Next Step" />
          </div>
        </div>
      </div>
    </main>
  );
}
