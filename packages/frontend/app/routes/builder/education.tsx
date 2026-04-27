import {
  data,
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useNavigate,
} from 'react-router';
import { z } from 'zod';
import type { Route } from '../../../.react-router/types/app/+types/root';

export { RouteErrorBoundary as ErrorBoundary } from '../../components/ErrorBoundaryContent';

import { type ChangeEvent, useCallback, useState } from 'react';
import Button from '../../components/Button';
import { HeadingWithSubHeading } from '../../components/HeadingWithSubHeading';
import Input, { type FormErrors } from '../../components/Input';
import Main from '../../components/Main';
import {
  isCertificateEducationLevel,
  isDiplomaEducationLevel,
  normalizeEducationEntry,
  parseEducationIndexParam,
} from '../../utils/education';
import { addQueryParams } from '../../utils/navigation';
import { BaseEducationSchema } from '../../utils/schemas/education';
import {
  clearQueuedEducation,
  getEducationDetails,
  getQueuedEducation,
  setQueuedEducation,
  updateUser,
} from '../../utils/user';

const EducationSchema = BaseEducationSchema.superRefine((education, ctx) => {
  if (!education.degree.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Degree is required.',
      path: ['degree'],
    });
  }

  if (
    !isCertificateEducationLevel(education.educationLevel) &&
    !education.location.trim()
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Location is required.',
      path: ['location'],
    });
  }
});

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const entries = Object.fromEntries(formData);
  const url = new URL(request.url);
  const index = parseEducationIndexParam(url.searchParams.get('index'));
  const returnUrl = url.searchParams.get('returnUrl');
  const redirectUrl = addQueryParams('/education-summary', {
    returnUrl: returnUrl ?? null,
  });
  const queuedEducation = getQueuedEducation();
  const createdData = normalizeEducationEntry({
    ...queuedEducation,
    ...entries,
    currentlyEnrolled: formData.get('currentlyEnrolled') === 'on',
  });

  try {
    const validatedData = EducationSchema.parse(createdData);

    updateUser('education', validatedData, index);
    clearQueuedEducation();
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

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const returnUrl = url.searchParams.get('returnUrl');
  const queuedEducation = getQueuedEducation();
  const index = parseEducationIndexParam(url.searchParams.get('index'));

  if (queuedEducation) {
    return {
      prevEducation: queuedEducation,
      returnUrl,
      index,
    };
  }

  if (typeof index === 'number') {
    const education = getEducationDetails(index);
    if (education) {
      setQueuedEducation(education);
      return {
        prevEducation: education,
        returnUrl,
        index,
      };
    }
  }

  if (typeof index !== 'number') {
    return redirect(
      addQueryParams('/education-level', {
        returnUrl: returnUrl ?? null,
      }),
    );
  }

  return {
    prevEducation: undefined,
    returnUrl,
    index,
  };
}

export default function Education() {
  const actionData = useActionData<typeof clientAction>();
  const { prevEducation, returnUrl, index } =
    useLoaderData<typeof clientLoader>();
  const errors = actionData?.errors;
  const navigate = useNavigate();

  const [isCurrentlyEnrolled, setIsCurrentlyEnrolled] = useState(
    prevEducation?.currentlyEnrolled ?? false,
  );
  const isCertificate = isCertificateEducationLevel(
    prevEducation?.educationLevel,
  );
  const usesDiploma = isDiplomaEducationLevel(prevEducation?.educationLevel);
  const fixedDegree = isCertificate
    ? 'Certificate'
    : usesDiploma
      ? 'Diploma'
      : null;

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
        {typeof index === 'number' ? (
          <input type="hidden" name="index" value={index} />
        ) : null}
        <Input
          label="School Name"
          type="text"
          id="schoolName"
          error={errors}
          required
          defaultValue={prevEducation?.schoolName}
        />

        {fixedDegree ? (
          <input type="hidden" id="degree" name="degree" value={fixedDegree} />
        ) : (
          <Input
            label="Degree"
            type="text"
            id="degree"
            error={errors}
            required
            defaultValue={prevEducation?.degree}
          />
        )}

        <Input
          label={isCertificate ? 'Location (Optional)' : 'Location'}
          type="text"
          id="location"
          error={errors}
          required={!isCertificate}
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
                      index:
                        typeof index === 'number' ? index.toString() : null,
                      returnUrl: returnUrl ?? null,
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
