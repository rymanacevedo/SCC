// app/routes/builder.personal.tsx
import { Form, redirect, useActionData } from 'react-router';
import { z } from 'zod';
import type { Route } from '../../../.react-router/types/app/+types/root';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Heading from '../../components/Heading';

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
    <main className="max-w-2xl mx-auto">
      <div className="mb-8">
        <Heading
          level="h1"
          size="text-2xl"
          text="Tell us a bit about yourself"
          bold={true}
          classNames="mb-2"
        />
        <Heading
          level="h2"
          size="text-sm"
          text="Let's start with your basic information"
          color="dark:text-gray-400 text-gray-600"
        />
      </div>

      <Form method="post" className="space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* First Name */}
          <Input label="First Name" type="text" id="firstname" />

          {/* Last Name */}
          <Input label="Last Name" type="text" id="lastName" />

          {/* City */}
          <Input label="City" type="text" id="city" />

          {/* State */}
          <Input label="State" type="text" id="state" />

          {/* ZIP Code */}
          <Input label="Zip Code" type="text" id="zipCode" />

          {/* Phone */}
          <Input label="Phone" type="text" id="phone" />

          {/* Email */}
          <Input label="Email" type="email" id="email" />
        </div>

        <div className="flex justify-end">
          <Button action="submit" text="Next Step" />
        </div>
      </Form>
    </main>
  );
}
