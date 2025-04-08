// app/routes/builder.personal.tsx
import {
  Form,
  redirect,
  useActionData,
  data,
  useLoaderData,
  type ClientLoaderFunctionArgs,
} from 'react-router';
import { z } from 'zod';
import type { Route } from '../../../.react-router/types/app/+types/root';
import Button from '../../components/Button';
import Input, { type FormErrors } from '../../components/Input';
import { clearQueuedExperience, getUser, updateUser } from '../../utils/user';
import type { ActionData } from '../../models/Actions';
import Main from '../../components/Main';
import { HeadingWithSubHeading } from '../../components/HeadingWithSubHeading';

export const PersonalInfoSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(2, 'State is required'),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code'),
  phone: z
    .string()
    .optional()
    .refine((val) => !val || /^\d{10}$/.test(val), {
      message: 'Phone number must be 10 digits',
    }),
  email: z.string().email('Invalid email address'),
});

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const entries = Object.fromEntries(formData);
  const url = new URL(request.url);
  const returnUrl = url.searchParams.get('returnUrl');

  const redirectUrl = returnUrl ? returnUrl : '/experience';
  try {
    const validatedData = PersonalInfoSchema.parse(entries);

    updateUser('info', validatedData);
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
  clearQueuedExperience();
  const url = new URL(request.url);
  const returnUrl = url.searchParams.get('returnUrl');

  return {
    prevInfo: user?.info,
    returnUrl,
  };
}

export default function PersonalInfo() {
  const actionData = useActionData<ActionData>();
  const errors = actionData?.data.errors;
  const { returnUrl, prevInfo } = useLoaderData<typeof clientLoader>();

  return (
    <Main>
      <HeadingWithSubHeading
        firstHeading="Tell us a bit about yourself"
        secondHeading="Let's start with your basic information."
      />

      <Form method="post" className="space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* First Name */}
          <Input
            label="First Name"
            type="text"
            id="firstName"
            error={errors}
            defaultValue={prevInfo?.firstName}
          />

          {/* Last Name */}
          <Input
            label="Last Name"
            type="text"
            id="lastName"
            error={errors}
            defaultValue={prevInfo?.lastName}
          />

          {/* City */}
          <Input
            label="City"
            type="text"
            id="city"
            error={errors}
            defaultValue={prevInfo?.city}
          />

          {/* TODO: selectbox for future release */}
          {/* State */}
          <Input
            label="State"
            type="text"
            id="state"
            error={errors}
            defaultValue={prevInfo?.state}
          />

          {/* ZIP Code */}
          <Input
            label="Zip Code"
            type="text"
            id="zipCode"
            error={errors}
            defaultValue={prevInfo?.zipCode}
          />

          {/* Phone */}
          <Input
            label="Phone"
            type="tel"
            id="phone"
            error={errors}
            defaultValue={prevInfo?.phone}
          />

          {/* Email */}
          <Input
            label="Email"
            type="email"
            id="email"
            error={errors}
            defaultValue={prevInfo?.email}
          />
        </div>

        <div className="flex justify-end">
          <Button action="submit" text={returnUrl ? 'Resubmit' : 'Next'} />
        </div>
      </Form>
    </Main>
  );
}
