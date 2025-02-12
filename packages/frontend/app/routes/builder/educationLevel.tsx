import { memo } from 'react';
import Heading from '../../components/Heading';
import Button from '../../components/Button';
import {
  type ClientActionFunctionArgs,
  data,
  Form,
  redirect,
} from 'react-router';
import { z } from 'zod';
import { updateUser } from '../../utils/user';

export const EducationLevelSchema = z.string().min(1);

export async function clientAction({ request }: ClientActionFunctionArgs) {
  const formData = await request.formData();
  const educationLevel = formData.get('educationLevel');
  try {
    const validatedData = EducationLevelSchema.parse(educationLevel);
    updateUser('education', {educationLevel: validatedData});
    return redirect('/education');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return data({ error: 'Something bad happened.' }, { status: 409 });
    }
  }
}

function EducationLevel() {
  return (
    <main className="max-w-2xl mx-auto">
      <div className="mb-8">
        <Heading
          level="h1"
          size="text-2xl"
          text="What best describes your level of education?"
          bold={true}
          classNames="mb-2"
        />
        <Heading
          level="h2"
          size="text-sm"
          text="Select the best option and we'll help you structure your education section."
          color="dark:text-gray-400 text-gray-600"
        />
      </div>
      <Form
        method="post"
        className="flex flex-col md:flex-row md:flex-wrap justify-center gap-4 max-w-xs md:max-w-4xl mx-auto"
      >
        {[
          'High School or GED',
          'Associates',
          'Bachelors',
          'Masters',
          'PhD',
          'Some College',
          'Vocational',
        ].map((e) => (
          <Button
            name="educationLevel"
            key={e}
            value={e}
            text={e}
            type="secondary"
            action="submit"
          />
        ))}
      </Form>
    </main>
  );
}

export default memo(EducationLevel);
