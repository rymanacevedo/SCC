import {
  data,
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useNavigate,
} from 'react-router';
import type { Route } from '../../../.react-router/types/app/+types/root';
import { z } from 'zod';
import Button from '../../components/Button';
import Input, { type FormErrors } from '../../components/Input';
import Heading from '../../components/Heading';
import {
  getExperienceDetails,
  getQueuedExperience,
  setQueuedExperience,
} from '../../utils/user';
import type { ActionData } from './info';
import { addQueryParams } from '../../utils/navigation';
import { type ChangeEvent, useCallback, useState } from 'react';

export const BaseExperienceSchema = z.object({
  jobId: z.string().min(1),
  jobTitle: z.string().min(1, 'Job Title is required.'),
  employer: z.string().min(1, 'Employer is required.'),
  location: z.string().min(1, 'Location is required.'),
  startDate: z
    .string()
    .min(1, 'Start date is required.')
    .transform((date) => new Date(date))
    .refine((date) => !Number.isNaN(date.getTime), {
      message: 'Invalid state date format.',
    })
    .refine((date) => date <= new Date(), {
      message: 'State date cannot be in the future.',
    }),
  endDate: z
    .string()
    .transform((date) => (date ? new Date(date) : undefined))
    .optional()
    .refine((date) => !date || !Number.isNaN(date.getTime), {
      message: 'Invalid end date format',
    }),
  currentlyEmployed: z.boolean().default(false),
  details: z.array(z.string()).optional(),
});

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
    setQueuedExperience(validatedData);

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
  const exp = getQueuedExperience();
  if (jobId) {
    const experience = getExperienceDetails(jobId);
    return data({ prevExperience: experience, jobId });
  }
  return data({ prevExperience: exp, jobId });
}

export default function WorkExperience() {
  const actionData = useActionData<ActionData>();
  const { prevExperience, jobId } = useLoaderData<typeof clientLoader>();
  const errors = actionData?.data.errors;
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
    <main className="max-w-2xl mx-auto">
      <div className="mb-8">
        <Heading
          level="h1"
          size="text-2xl"
          text="Tell us about your most recent job"
          bold={true}
          classNames="mb-2"
        />
        <Heading
          level="h2"
          size="text-sm"
          text="We'll start there and work backwards."
          color="dark:text-gray-400 text-gray-600"
        />
      </div>

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
            label="Location"
            type="text"
            id="location"
            placeholder="Denver, CO"
            error={errors}
            defaultValue={prevExperience?.location}
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
              callback={() => navigate('/info')}
            />
          ) : null}

          <Button action="submit" text="Next Step" />
        </div>
      </Form>
    </main>
  );
}
