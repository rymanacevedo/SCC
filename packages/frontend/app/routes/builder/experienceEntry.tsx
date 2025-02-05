import { Form, useFetcher } from 'react-router';
import Button from '../../components/Button';
import Heading from '../../components/Heading';
import { useState } from 'react';
import Input from '../../components/Input';

export default function ExperienceEntry() {
  const fetcher = useFetcher();
  const [userExperience, setUserExperience] = useState<string[]>([]);

  return (
    <main className="max-w-6xl mx-auto">
      <div className="mb-8">
        <Heading
          level="h1"
          size="text-2xl"
          text="What did you do as a Test Engineer?"
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
        <div>g
          <Form method="post" className="space-y-6">
            <div>
              <label
                htmlFor="summary"
                className="block text-sm font-medium dark:text-white text-gray-700 mb-2"
              >
                Job Description
              </label>
              <textarea
                id="summary"
                name="summary"
                rows={8}
                className="w-full border rounded-md shadow-sm p-3"
              />
              <p className="mt-2 text-sm dark:text-gray-400 text-gray-600">
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
                <li>Highlight 2-3 key achievements</li>
                <li>Mention your career goals or what you're looking for</li>
                <li>Keep it concise and focused</li>
              </ul>
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
          </Form>
        </div>

        {/* Right Column - Examples */}
        <div className="order-1 md:order-2">
          <fetcher.Form>
            <Input
              type="text"
              label="Search by Job Title for Pre-Written Examples"
              id="jobSearch"
            />
          </fetcher.Form>
          <Heading
            text="Example Summaries"
            level="h2"
            size="text-lg"
            classNames="mb-4"
          />
        </div>
      </div>
    </main>
  );
}
