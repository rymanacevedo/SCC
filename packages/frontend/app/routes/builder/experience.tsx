import { data, Form, redirect, useActionData } from 'react-router';
import type { Route } from '../../../.react-router/types/app/+types/root';
import { z } from 'zod';
import Button from '../../components/Button';
import Input, { type FormErrors } from '../../components/Input';
import Heading from '../../components/Heading';
import { updateUser } from '../../utils/user';
import type { ActionData } from './personalinfo';
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
    message: 'End date is required if not currently employed',
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
    message: 'End date cannot be before start date',
    path: ['endDate'],
  },
);

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const entries = Object.fromEntries(formData);

  const createdData = {
    ...entries,
    currentlyEmployed: formData.get('currentlyEmployed') === 'on',
  };

  try {
    const validatedData = ExperienceSchema.parse(createdData);
    updateUser('experience', validatedData);

    return redirect(`/experience-entry?jobId=${validatedData.jobId}`);
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
export default function WorkExperience() {
  const actionData = useActionData<ActionData>();
  const errors = actionData?.data.errors;

  const [isCurrentlyEmployed, setIsCurrentlyEmployed] = useState(false);

  const handleCheckboxChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setIsCurrentlyEmployed(e.target.checked);
    },
    [],
  );

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
            value={crypto.randomUUID()}
          />
          <Input label="Job Title" type="text" id="jobTitle" error={errors} />
          <Input label="Employer" type="text" id="employer" error={errors} />
          <Input label="Location" type="text" id="location" error={errors} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:col-span-2">
            <Input
              label="Start Date"
              type="month"
              id="startDate"
              error={errors}
            />
            <Input
              disabled={isCurrentlyEmployed}
              label="End Date"
              type="month"
              id="endDate"
              error={errors}
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
          <Button
            text="Previous"
            type="secondary"
            action="button"
            callback={() => window.history.back()}
          />

          <Button action="submit" text="Next Step" />
        </div>
      </Form>
    </main>
  );
}
