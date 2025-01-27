// app/routes/builder.education.tsx
import { redirect } from 'react-router';
import { Form, useActionData } from 'react-router';
import { z } from 'zod';
import type { Route } from '../../../.react-router/types/app/+types/root';

const EducationSchema = z.object({
  schoolName: z.string().min(1, 'School name is required'),
  degree: z.string().min(1, 'Degree is required'),
  fieldOfStudy: z.string().min(1, 'Field of study is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  current: z.boolean().optional(),
  location: z.string().optional(),
});

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const data = Object.fromEntries(formData);

  try {
    // const validatedData = EducationSchema.parse({
    //   ...data,
    //   current: data.current === 'on',
    // });
    // Save data to session or database
    return redirect('/skills');
  } catch (error) {
    if (error instanceof z.ZodError) {
      //   return json({ success: false, errors: error.flatten().fieldErrors });
    }
    // return json({ success: false, errors: { _form: ['An error occurred'] } });
  }
}

export default function Education() {
  const actionData = useActionData<typeof clientAction>();

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Tell us about your education
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Enter your education experience so far, even if you are a current
          student or did not graduate.
        </p>
      </div>

      <Form method="post" className="space-y-6">
        {/* School Name */}
        <div>
          <label
            htmlFor="schoolName"
            className="block text-sm font-medium text-gray-700"
          >
            School Name
          </label>
          <input
            type="text"
            name="schoolName"
            id="schoolName"
            className="mt-1 block w-full border shadow-sm"
          />
          {/* {actionData?.errors?.schoolName && (
            <p className="mt-1 text-sm text-red-600">
              {actionData.errors.schoolName[0]}
            </p>
          )} */}
        </div>

        {/* Degree */}
        <div>
          <label
            htmlFor="degree"
            className="block text-sm font-medium text-gray-700"
          >
            Degree
          </label>
          <input
            type="text"
            name="degree"
            id="degree"
            className="mt-1 block w-full border shadow-sm"
          />
          {/* {actionData?.errors?.degree && (
            <p className="mt-1 text-sm text-red-600">
              {actionData.errors.degree[0]}
            </p>
          )} */}
        </div>

        {/* Field of Study */}
        <div>
          <label
            htmlFor="fieldOfStudy"
            className="block text-sm font-medium text-gray-700"
          >
            Field of Study
          </label>
          <input
            type="text"
            name="fieldOfStudy"
            id="fieldOfStudy"
            className="mt-1 block w-full border shadow-sm"
          />
          {/* {actionData?.errors?.fieldOfStudy && (
            <p className="mt-1 text-sm text-red-600">
              {actionData.errors.fieldOfStudy[0]}
            </p>
          )} */}
        </div>

        {/* Location */}
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

        {/* Dates */}

        <div>
          <label
            htmlFor="graduationDate"
            className="block text-sm font-medium text-gray-700"
          >
            Graduation Date (or expected Graduation Date)
          </label>
          <input
            type="month"
            name="graduationDate"
            id="graduationDate"
            className="mt-1 block w-full border shadow-sm"
          />
        </div>

        {/* Current Student Checkbox */}
        <div className="flex items-center">
          <input
            type="checkbox"
            name="current"
            id="current"
            className="h-4 w-4 rounded border-gray-300 text-blue-600 
              focus:ring-blue-500"
          />
          <label htmlFor="current" className="ml-2 block text-sm text-gray-700">
            I am currently studying here
          </label>
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
  );
}
