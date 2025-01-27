// app/routes/builder.experience.tsx
import { Form } from 'react-router';

export default function WorkExperience() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Tell us about your most recent job
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          We'll start there and work backwards.
        </p>
      </div>

      <Form method="post" className="space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label
              htmlFor="jobTitle"
              className="block text-sm font-medium text-gray-700"
            >
              Job Title
            </label>
            <input
              type="text"
              name="jobTitle"
              id="jobTitle"
              className="mt-1 block w-full border shadow-sm"
            />
          </div>

          <div>
            <label
              htmlFor="employer"
              className="block text-sm font-medium text-gray-700"
            >
              Employer
            </label>
            <input
              type="text"
              name="employer"
              id="employer"
              className="mt-1 block w-full border shadow-sm"
            />
          </div>

          <div>
            <label
              htmlFor="location"
              className="block text-sm font-medium text-gray-700"
            >
              Location
            </label>
            <input
              type="text"
              name="location"
              id="location"
              className="mt-1 block w-full border shadow-sm"
            />
          </div>
          <div>
            <label
              htmlFor="startDate"
              className="block text-sm font-medium text-gray-700"
            >
              Start Date
            </label>
            <input
              className="mt-1 block w-full border shadow-sm"
              type="month"
              name="startMonth"
              id="startMonth"
            />
          </div>

          <div>
            <label
              htmlFor="endDate"
              className="block text-sm font-medium text-gray-700"
            >
              End Date
            </label>
            <input
              className="mt-1 block w-full border shadow-sm"
              type="month"
              name="endMonth"
              id="endMonth"
            />
          </div>
        </div>

        <div className="mt-4">
            <div className="flex items-center">
                <input
                    type="checkbox"
                    name="currentlyEmployed"
                    id="currentlyEmployed"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <label
                    htmlFor="currentlyEmployed"
                    className="ml-2 block text-sm text-gray-700"
                >
                    I currently work here
                </label>
            </div>
        </div>
        

        <div className="flex justify-between">
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
  );
}
