// app/routes/builder.education.tsx
import { data, redirect } from 'react-router';
import { Form, useActionData } from 'react-router';
import { z } from 'zod';
import type { Route } from '../../../.react-router/types/app/+types/root';
import Button from '../../components/Button';
import Input, { type FormErrors } from '../../components/Input';
import Heading from '../../components/Heading';
import { updateUser } from '../../utils/user';
import type { ActionData } from './personalinfo';
import educationLevel from './educationLevel';

export const BaseEducationSchema = z.object({
  schoolName: z.string().min(1, 'School name is required.'),
  educationLevel: z.string().min(1).optional(),
  degree: z.string().min(1, 'Degree is required.'),
  location: z.string().min(1, 'Location is required.'),
  graduationDate: z.string().optional(),
  currentlyEnrolled: z.enum(['on']).optional(),
});

const EducationSchema = BaseEducationSchema.refine(
  (data) => {
    if (!data.currentlyEnrolled) {
      return !!data.graduationDate;
    }
    return true;
  },
  {
    message: 'Graducation Date is required if not currently enrolled.',
    path: ['graduationDate'],
  },
);

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const entries = Object.fromEntries(formData);

  try {
    const validatedData = EducationSchema.parse(entries);

    updateUser('education', validatedData);
    return redirect('/skills');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return data(
        { errors: error.flatten().fieldErrors as FormErrors },
        { status: 400 },
      );
    }
    return data(
      { errors: { _form: ['An errored occured.'] } },
      { status: 409 },
    );
  }
}

export default function Education() {
  const actionData = useActionData<ActionData>();
  const errors = actionData?.data.errors;

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
        <Input label="School Name" type="text" id="schoolName" error={errors} />

        <Input label="Degree" type="text" id="degree" error={errors} />

        <Input label="Location" type="text" id="location" error={errors} />

        <Input
          label="Graduation Date"
          type="text"
          id="graduationDate"
          error={errors}
        />

        {/* Current Student Checkbox */}
        <div className="flex items-center">
          <input
            type="checkbox"
            name="currentlyEnrolled"
            id="currentlyEnrolled"
            className="h-4 w-4 rounded border-gray-300 text-blue-600 
              focus:ring-blue-500"
          />
          <label
            htmlFor="currentlyEnrolled"
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
