// app/routes/builder.personal.tsx
import { Form, redirect, useActionData } from 'react-router';
import { z } from 'zod';
import type { Route } from '../../../.react-router/types/app/+types/root';
import Button from '../../components/Button';
import Input from '../../components/Input';

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
    // const validatedData = PersonalInfoSchema.parse(data);
    // TODO: return json similar to v7
    // return json({ success: true, data: validatedData });
    return redirect('/experience');
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
          <Input name="First Name" type="text" id="firstname" />

          {/* Last Name */}
          <Input name="Last Name" type="text" id="lastName" />

          {/* City */}
          <Input name="City" type="text" id="city" />

          {/* State */}
          <Input name="State" type="text" id="state" />

          {/* ZIP Code */}
          <Input name="Zip Code" type="text" id="zipCode" />

          {/* Phone */}
          <Input name="Phone" type="text" id="phone" />

          {/* Email */}
          <Input name="Email" type="email" id="email" />
        </div>

        <div className="flex justify-end">
          <Button action="submit" text="Next Step" />
        </div>
      </Form>
    </div>
  );
}
