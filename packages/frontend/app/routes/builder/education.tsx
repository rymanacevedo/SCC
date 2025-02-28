// app/routes/builder.education.tsx
import {
  type ClientLoaderFunctionArgs,
  data,
  redirect,
  useLoaderData,
} from 'react-router';
import { Form, useActionData } from 'react-router';
import { z } from 'zod';
import type { Route } from '../../../.react-router/types/app/+types/root';
import Button from '../../components/Button';
import Input, { type FormErrors } from '../../components/Input';
import { getUser, updateUser } from '../../utils/user';
import type { ActionData } from '../../models/Actions';
import { EducationLevelSchema } from './educationLevel';
import { type ChangeEvent, useCallback, useState } from 'react';
import Main from '../../components/Main';
import { HeadingWithSubHeading } from '../../components/HeadingWithSubHeading';

export const BaseEducationSchema = z.object({
  schoolName: z.string().min(1, 'School name is required.').optional(),
  educationLevel: EducationLevelSchema.optional(),
  degree: z.string().min(1, 'Degree is required.').optional(),
  location: z.string().min(1, 'Location is required.').optional(),
  graduationDate: z
    .string()
    .transform((date) => (date ? new Date(date) : undefined))
    .optional()
    .refine((date) => !date || !Number.isNaN(date.getTime), {
      message: 'Invalid end date format',
    }),
  currentlyEnrolled: z.boolean().default(false),
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
  const url = new URL(request.url);
  const returnUrl = url.searchParams.get('returnUrl');

  const redirectUrl = returnUrl ? returnUrl : '/skills';
  const createdData = {
    ...entries,
    currentlyEnrolled: formData.get('currentlyEnrolled') === 'on',
  };

  try {
    const validatedData = EducationSchema.parse(createdData);

    updateUser('education', validatedData);
    return redirect(redirectUrl);
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

export async function clientLoader({ request }: ClientLoaderFunctionArgs) {
  const user = getUser();
  const url = new URL(request.url);
  const returnUrl = url.searchParams.get('returnUrl');

  return {
    prevEducation: user?.education,
    returnUrl,
  };
}

export default function Education() {
  const actionData = useActionData<ActionData>();
  const { prevEducation, returnUrl } = useLoaderData<typeof clientLoader>();
  const errors = actionData?.data.errors;

  const [isCurrentlyEnrolled, setIsCurrentlyEnrolled] = useState(
    prevEducation?.currentlyEnrolled ?? false,
  );

  const handleCheckboxChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setIsCurrentlyEnrolled(e.target.checked);
    },
    [],
  );

  return (
    <Main>
      <HeadingWithSubHeading
        firstHeading="Tell us about your education"
        secondHeading="Enter your education experience so far, even if you are a current
          student or did not graduate."
      />

      <Form method="post" className="space-y-6">
        <Input
          label="School Name"
          type="text"
          id="schoolName"
          error={errors}
          defaultValue={prevEducation?.schoolName}
        />

        {prevEducation?.educationLevel === 'High School or GED' ||
        prevEducation?.educationLevel === 'Some College' ? (
          <input type="hidden" id="degree" name="degree" value="Diploma" />
        ) : (
          <Input
            label="Degree or Certificate"
            type="text"
            id="degree"
            error={errors}
            defaultValue={prevEducation?.degree}
          />
        )}

        <Input
          label="Location"
          type="text"
          id="location"
          error={errors}
          defaultValue={prevEducation?.location}
        />

        <Input
          disabled={isCurrentlyEnrolled}
          label="Graduation Year"
          type="number"
          min={1900}
          max={2099}
          step={1}
          id="graduationDate"
          error={errors}
          defaultValue={prevEducation?.graduationDate
            ?.getUTCFullYear()
            .toString()}
        />

        {/* Current Student Checkbox */}
        <div className="flex items-center">
          <input
            type="checkbox"
            name="currentlyEnrolled"
            id="currentlyEnrolled"
            className="h-4 w-4 rounded border-gray-300 text-blue-600 
              focus:ring-blue-500"
            onChange={handleCheckboxChange}
            checked={isCurrentlyEnrolled}
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
          {returnUrl ? (
            <Button action="submit" text="Resubmit" />
          ) : (
            <>
              <Button
                text="Previous"
                type="secondary"
                action="button"
                callback={() => window.history.back()}
              />
              <Button action="submit" text="Next Step" />
            </>
          )}
        </div>
      </Form>
    </Main>
  );
}
