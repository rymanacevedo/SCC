import { Form, redirect } from 'react-router';
import type { Route } from '../../../.react-router/types/app/+types/root';
import { z } from 'zod';

const EducationSchema = z.object({
  schoolName: z.string().min(1, 'School name is required'),
  degree: z.string().min(1, 'Degree is required'),
  fieldOfStudy: z.string().min(1, 'Field of study is required'),
  location: z.string().min(1, 'Location is required'),
  graduationDate: z.string().min(1, 'Graduation date is required'),
  currentlyStudying: z.boolean().optional(),
});

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const data = Object.fromEntries(formData);

  try {
    // const validatedData = EducationSchema.parse(data);
    // TODO: return json similar to v7
    // return json({ success: true, data: validatedData });
    return redirect('/education');
  } catch (error) {
    if (error instanceof z.ZodError) {
      // TODO: return json similar to v7
      //   return json({ success: false, errors: error.flatten().fieldErrors });
    }
    // return json({ success: false, errors: { _form: ['An error occurred'] } });
  }
}
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
