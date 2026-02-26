import { type ChangeEvent, useCallback, useState } from 'react';
// app/routes/builder.education.tsx
export { RouteErrorBoundary as ErrorBoundary } from '../../components/RouteErrorBoundary';
import {
  type ClientLoaderFunctionArgs,
  data,
  redirect,
  useLoaderData,
  useNavigate,
} from 'react-router';
import { Form, useActionData } from 'react-router';
import { z } from 'zod';
import type { Route } from '../../../.react-router/types/app/+types/root';
import Button from '../../components/Button';
import { HeadingWithSubHeading } from '../../components/HeadingWithSubHeading';
import Input, { type FormErrors } from '../../components/Input';
import Main from '../../components/Main';
import type { ActionData } from '../../models/Actions';
import { addQueryParams } from '../../utils/navigation';
import { getUser, updateUser } from '../../utils/user';
import { EducationLevelSchema } from './educationLevel';

export const BaseEducationSchema = z.object({
  schoolName: z.string().optional(),
  educationLevel: EducationLevelSchema.optional(),
  degree: z.string().min(1, 'Degree is required.'),
  location: z.string().min(1, 'Location is required.'),
  graduationDate: z
    .string()
    .transform((val) => {
      if (!val) return undefined;
      const year = Number.parseInt(val, 10);
      if (Number.isNaN(year)) return undefined;
      return year;
    })
    .pipe(
      z
        .number()
        .min(1900, { message: 'Graduation Year must be 1900 or later.' })
        .max(2099, { message: 'Graduation Year must be 2099 or earlier.' })
        .transform((year) => year.toString()) // Transform back to string
        .optional(),
    ),
  currentlyEnrolled: z.boolean().default(false),
});

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const entries = Object.fromEntries(formData);
  const url = new URL(request.url);
  const returnUrl = url.searchParams.get('returnUrl');
  const educationIndex = url.searchParams.get('educationIndex');
  const index = educationIndex !== null ? Number(educationIndex) : undefined;

  const redirectUrl = returnUrl ? returnUrl : '/education-summary';
  const createdData = {
    ...entries,
    currentlyEnrolled: formData.get('currentlyEnrolled') === 'on',
  };

  // Certificate education level makes location optional
  const user = getUser();
  const educationEntry =
    index !== undefined ? user?.education?.[index] : undefined;
  const schema =
    educationEntry?.educationLevel === 'Certificate'
      ? BaseEducationSchema.extend({
          location: z.string().optional(),
        })
      : BaseEducationSchema;

  try {
    const validatedData = schema.parse(createdData);

    updateUser('education', validatedData, index);
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

const MAX_EDUCATION_ENTRIES = 3;

export async function clientLoader({ request }: ClientLoaderFunctionArgs) {
  const user = getUser();
  const url = new URL(request.url);
  const returnUrl = url.searchParams.get('returnUrl');
  const educationIndex = url.searchParams.get('educationIndex');
  const index = educationIndex !== null ? Number(educationIndex) : 0;
  const currentCount = user?.education?.length ?? 0;

  // Prevent adding beyond the max — only block new entries, not edits
  if (index >= MAX_EDUCATION_ENTRIES && index >= currentCount) {
    return redirect('/education-summary');
  }

  return {
    prevEducation: user?.education?.[index],
    returnUrl,
    educationIndex: educationIndex ?? '0',
  };
}

export default function Education() {
  const actionData = useActionData<typeof clientAction>();
  const { prevEducation, returnUrl, educationIndex } =
    useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();
  const errors = actionData?.errors;

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

        {prevEducation?.educationLevel === 'High School' ||
        prevEducation?.educationLevel === 'GED' ||
        prevEducation?.educationLevel === 'Some College' ? (
          <input type="hidden" id="degree" name="degree" value="Diploma" />
        ) : prevEducation?.educationLevel === 'Certificate' ? (
          <input type="hidden" id="degree" name="degree" value="Certificate" />
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
          label={
            prevEducation?.educationLevel === 'Certificate'
              ? 'Location (optional)'
              : 'Location'
          }
          type="text"
          id="location"
          error={errors}
          defaultValue={prevEducation?.location}
        />

        <Input
          disabled={isCurrentlyEnrolled}
          label="Graduation Year"
          type="number"
          step={1}
          id="graduationDate"
          error={errors}
          defaultValue={prevEducation?.graduationDate?.toString()}
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
                callback={() =>
                  navigate(
                    addQueryParams('/education-level', {
                      educationIndex,
                    }),
                  )
                }
              />
              <Button action="submit" text="Next Step" />
            </>
          )}
        </div>
      </Form>
    </Main>
  );
}
