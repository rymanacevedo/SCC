// app/routes/builder.education.tsx
import { redirect } from 'react-router';
import { Form, useActionData } from 'react-router';
import { z } from 'zod';
import type { Route } from '../../../.react-router/types/app/+types/root';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Heading from '../../components/Heading';

export const EducationSchema = z.object({
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
    return redirect('/education');
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
        <Heading
          level="h1"
          size="text-2xl"
          text="Tell us about your education"
          bold={true}
          classNames="mb-2"
        />
        <Heading
          level="h2"
          size="text-sm"
          text="Enter your education experience so far, even if you are a current
          student or did not graduate."
          color="dark:text-gray-400 text-gray-600"
        />
      </div>

      <Form method="post" className="space-y-6">
        <Input label="School Name" type="text" id="schoolName" />

        <Input label="Degree" type="text" id="degree" />

        <Input label="Location" type="text" id="location" />

        <Input label="Graduation Date" type="text" id="graduationDate" />

        {/* Current Student Checkbox */}
        <div className="flex items-center">
          <input
            type="checkbox"
            name="current"
            id="current"
            className="h-4 w-4 rounded border-gray-300 text-blue-600 
              focus:ring-blue-500"
          />
          <label
            htmlFor="current"
            className="ml-2 block text-sm dark:text-gray-300 text-gray-700"
          >
            I am currently studying here
          </label>
        </div>

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
  );
}
