import { Form, redirect } from 'react-router';
import type { Route } from '../../../.react-router/types/app/+types/root';
import { z } from 'zod';
import Button from '../../components/Button';
import Input from '../../components/Input';

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
          <Input name="Job Title" type="text" id="jobTitle" />

          <Input name="Employer" type="text" id="employer" />
          <Input name="Location" type="text" id="location" />

          <Input name="Start Date" type="month" id="startDate" />

          <Input name="End Date" type="month" id="endDate" />
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
  );
}
