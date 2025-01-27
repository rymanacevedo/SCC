// app/routes/builder.personal.tsx
import { Form, redirect, useActionData } from 'react-router';
import { z } from 'zod';
import type { Route } from '../../../.react-router/types/app/+types/root';

const PersonalInfoSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(2, 'State is required'),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code'),
  phone: z.string().regex(/^\d{10}$/, 'Phone number must be 10 digits'),
  email: z.string().email('Invalid email address'),
});

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const data = Object.fromEntries(formData);

  try {
    const validatedData = PersonalInfoSchema.parse(data);
    // TODO: return json similar to v7
    // return json({ success: true, data: validatedData });
    redirect('/experience');
  } catch (error) {
    if (error instanceof z.ZodError) {
      // TODO: return json similar to v7
      //   return json({ success: false, errors: error.flatten().fieldErrors });
    }
    // return json({ success: false, errors: { _form: ['An error occurred'] } });
  }
}

export default function PersonalInfo() {
  const actionData = useActionData<typeof clientAction>();

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Tell us a bit about yourself
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Let's start with your basic information
        </p>
      </div>

      <Form method="post" className="space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* First Name */}
          <div>
            <label
              htmlFor="firstName"
              className="block text-sm font-medium text-gray-700"
            >
              First Name
            </label>
            <input
              type="text"
              name="firstName"
              id="firstName"
              className="mt-1 block w-full border shadow-sm"
            />
            {/* {actionData?.errors?.firstName && (
              <p className="mt-1 text-sm text-red-600">
                {actionData.errors.firstName[0]}
              </p>
            )} */}
          </div>

          {/* Last Name */}
          <div>
            <label
              htmlFor="lastName"
              className="block text-sm font-medium text-gray-700"
            >
              Last Name
            </label>
            <input
              type="text"
              name="lastName"
              id="lastName"
              className="mt-1 block w-full border shadow-sm"
            />
            {/* {actionData?.errors?.lastName && (
              <p className="mt-1 text-sm text-red-600">
                {actionData.errors.lastName[0]}
              </p>
            )} */}
          </div>

          {/* City */}
          <div>
            <label
              htmlFor="city"
              className="block text-sm font-medium text-gray-700"
            >
              City
            </label>
            <input
              type="text"
              name="city"
              id="city"
              className="mt-1 block w-full border shadow-sm"
            />
            {/* {actionData?.errors?.city && (
              <p className="mt-1 text-sm text-red-600">
                {actionData.errors.city[0]}
              </p>
            )} */}
          </div>

          {/* State */}
          <div>
            <label
              htmlFor="state"
              className="block text-sm font-medium text-gray-700"
            >
              State
            </label>
            <input
              type="text"
              name="state"
              id="state"
              className="mt-1 block w-full border shadow-sm"
            />
            {/* {actionData?.errors?.state && (
              <p className="mt-1 text-sm text-red-600">
                {actionData.errors.state[0]}
              </p>
            )} */}
          </div>

          {/* ZIP Code */}
          <div>
            <label
              htmlFor="zipCode"
              className="block text-sm font-medium text-gray-700"
            >
              ZIP Code
            </label>
            <input
              type="text"
              name="zipCode"
              id="zipCode"
              className="mt-1 block w-full border shadow-sm"
            />
            {/* {actionData?.errors?.zipCode && (
              <p className="mt-1 text-sm text-red-600">
                {actionData.errors.zipCode[0]}
              </p>
            )} */}
          </div>

          {/* Phone */}
          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-gray-700"
            >
              Phone
            </label>
            <input
              type="tel"
              name="phone"
              id="phone"
              className="mt-1 block w-full border shadow-sm"
            />
            {/* {actionData?.errors?.phone && (
              <p className="mt-1 text-sm text-red-600">
                {actionData.errors.phone[0]}
              </p>
            )} */}
          </div>

          {/* Email */}
          <div className="sm:col-span-2">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              type="email"
              name="email"
              id="email"
              className="mt-1 block w-full border shadow-sm"
            />
            {/* {actionData?.errors?.email && (
              <p className="mt-1 text-sm text-red-600">
                {actionData.errors.email[0]}
              </p>
            )} */}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex justify-center rounded-md border border-transparent 
              bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm 
              hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 
              focus:ring-offset-2"
          >
            Next Step
          </button>
        </div>
      </Form>
    </div>
  );
}
