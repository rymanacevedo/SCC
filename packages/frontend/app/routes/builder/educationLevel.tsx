import { memo } from 'react';
import Button from '../../components/Button';
import {
  type ClientActionFunctionArgs,
  data,
  Form,
  redirect,
  useNavigate,
} from 'react-router';
import { z } from 'zod';
import { updateUser } from '../../utils/user';
import Main from '../../components/Main';
import { HeadingWithSubHeading } from '../../components/HeadingWithSubHeading';

export const EducationLevelSchema = z.union([
  z.literal('GED'),
  z.literal('High School'),
  z.literal('Associates'),
  z.literal('Bachelors'),
  z.literal('Masters'),
  z.literal('PhD'),
  z.literal('Some College'),
  z.literal('Vocational'),
]);

const educationLevels = EducationLevelSchema.options.map(
  (option) => option.value,
);

export async function clientAction({ request }: ClientActionFunctionArgs) {
  const formData = await request.formData();
  const educationLevel = formData.get('educationLevel');
  try {
    const validatedData = EducationLevelSchema.parse(educationLevel);
    updateUser('education', { educationLevel: validatedData });
    return redirect('/education');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return data({ error: 'Something bad happened.' }, { status: 409 });
    }
  }
}

function EducationLevel() {
  const navigate = useNavigate();
  return (
    <Main>
      <HeadingWithSubHeading
        firstHeading="What best describes your level of education?"
        secondHeading="Select the best option and we'll help you structure your education section."
      />

      <Form
        method="post"
        className="flex flex-col md:flex-row md:flex-wrap justify-center gap-4 max-w-xs md:max-w-4xl mx-auto"
      >
        {educationLevels.map((e) => (
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
      <Button
        text="Previous"
        type="secondary"
        action="button"
        callback={() => navigate(-1)}
      />
    </Main>
  );
}

export default memo(EducationLevel);
