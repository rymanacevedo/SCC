import { type ChangeEvent, useCallback, useState } from 'react';
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
import Button from '../../components/Button';
import { HeadingWithSubHeading } from '../../components/HeadingWithSubHeading';
import Input, { type FormErrors } from '../../components/Input';
import Main from '../../components/Main';
import Select from '../../components/Select';
import type { ActionData } from '../../models/Actions';
import { addQueryParams } from '../../utils/navigation';
import { BaseExperienceSchema } from '../../utils/schemas/experience';
import {
  getExperienceDetails,
  getQueuedExperience,
  setQueuedExperience,
} from '../../utils/user';
import { usStates } from '../../utils/usStates';

export { RouteErrorBoundary as ErrorBoundary } from '../../components/ErrorBoundaryContent';

const ExperienceSchema = BaseExperienceSchema.refine(
  (data) => {
    if (!data.currentlyEmployed) {
      return !!data.endDate;
    }
    return true;
  },
  {
    message: 'End date is required if not currently employed.',
    path: ['endDate'],
  },
).refine(
  (data) => {
    if (data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  {
    message: 'End date cannot be before start date.',
    path: ['endDate'],
  },
);

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const entries = Object.fromEntries(formData);
  const url = new URL(request.url);
  const jobId = url.searchParams.get('jobId');
  const returnUrl = url.searchParams.get('returnUrl');
  const redirectUrl = addQueryParams('/experience-entry', {
    jobId,
    returnUrl,
  });
  const createdData = {
    ...entries,
    currentlyEmployed: formData.get('currentlyEmployed') === 'on',
  };

  try {
    const validatedData = ExperienceSchema.parse(createdData);
    const exp = getQueuedExperience();
    if (exp?.details) {
      // hot fix to get details without storing in form
      validatedData.details = exp.details;
      setQueuedExperience(validatedData);
    } else {
      setQueuedExperience(validatedData);
    }

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
  const jobId = url.searchParams.get('jobId');
  const returnUrl = url.searchParams.get('returnUrl');
  const exp = getQueuedExperience();
  // we prefer the experience in the queue first over the jobId
  if (exp) {
    return data({ prevExperience: exp, jobId, returnUrl });
  }

  // Only fall back to getting experience details if no queued experience
  if (jobId) {
    const experience = getExperienceDetails(jobId);
    if (experience) {
      setQueuedExperience(experience);
    }
    return data({ prevExperience: experience, jobId, returnUrl });
  }

  return data({ prevExperience: undefined, jobId: undefined, returnUrl });
}

export default function WorkExperience() {
  const actionData = useActionData<typeof clientAction>();
  const { prevExperience, jobId, returnUrl } =
    useLoaderData<typeof clientLoader>();
  const errors = actionData?.errors;
  const navigate = useNavigate();
  const [isCurrentlyEmployed, setIsCurrentlyEmployed] = useState(
    prevExperience?.currentlyEmployed ?? false,
  );

  const handleCheckboxChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setIsCurrentlyEmployed(e.target.checked);
    },
    [],
  );

  const dateToMonthString = (date: Date | undefined) => {
    if (!date) return;
    return date.toISOString().slice(0, 7);
  };

  return (
    <Main>
      <HeadingWithSubHeading
        firstHeading="Tell us about your most recent job"
        secondHeading="We'll start there and work backwards."
      />

      <Form method="post" className="space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <input
            type="hidden"
            name="jobId"
            id="jobId"
            value={
              prevExperience?.jobId ? prevExperience.jobId : crypto.randomUUID()
            }
          />
          <Input
            label="Job Title"
            type="text"
            id="jobTitle"
            error={errors}
            defaultValue={prevExperience?.jobTitle}
          />
          <Input
            label="Employer"
            type="text"
            id="employer"
            error={errors}
            defaultValue={prevExperience?.employer}
          />
          <Input
            label="City"
            type="text"
            id="city"
            placeholder="Denver"
            error={errors}
            defaultValue={prevExperience?.city}
          />
          <Select
            label="State"
            id="state"
            options={usStates}
            placeholder="Select a state"
            error={errors}
            defaultValue={prevExperience?.state}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:col-span-2">
            <Input
              label="Start Date"
              type="month"
              id="startDate"
              error={errors}
              defaultValue={dateToMonthString(prevExperience?.startDate)}
            />
            <Input
              disabled={isCurrentlyEmployed}
              label="End Date"
              type="month"
              id="endDate"
              error={errors}
              defaultValue={dateToMonthString(prevExperience?.endDate)}
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
              onChange={handleCheckboxChange}
              checked={isCurrentlyEmployed}
            />
            <label
              htmlFor="currentlyEmployed"
              className="ml-2 block text-sm dark:text-gray-300 text-gray-700"
            >
              I currently work here
            </label>
          </div>
        </div>

        <div className="flex justify-between">
          {!jobId ? (
            <Button
              text="Previous"
              type="secondary"
              action="button"
              callback={() =>
                navigate(
                  returnUrl
                    ? addQueryParams('/experience-summary', { returnUrl })
                    : '/info',
                )
              }
            />
          ) : null}

          <Button action="submit" text="Next Step" />
        </div>
      </Form>
    </Main>
  );
}
