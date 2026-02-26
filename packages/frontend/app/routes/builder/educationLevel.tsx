import { memo } from 'react';
export { RouteErrorBoundary as ErrorBoundary } from '../../components/RouteErrorBoundary';
import {
  type ClientActionFunctionArgs,
  type ClientLoaderFunctionArgs,
  Form,
  data,
  redirect,
  useNavigate,
} from 'react-router';
import { z } from 'zod';
import Button from '../../components/Button';
import { HeadingWithSubHeading } from '../../components/HeadingWithSubHeading';
import Main from '../../components/Main';
import { addQueryParams } from '../../utils/navigation';
import { getUser, updateUser } from '../../utils/user';

const PREVIOUS_ROUTE = '/experience-summary';
const MAX_EDUCATION_ENTRIES = 3;

export const EducationLevelSchema = z.union([
  z.literal('GED'),
  z.literal('High School'),
  z.literal('Associates'),
  z.literal('Bachelors'),
  z.literal('Masters'),
  z.literal('PhD'),
  z.literal('Some College'),
  z.literal('Vocational'),
  z.literal('Certificate'),
]);

const educationLevels = EducationLevelSchema.options.map(
  (option) => option.value,
);

export async function clientLoader({ request }: ClientLoaderFunctionArgs) {
  const url = new URL(request.url);
  const educationIndex = url.searchParams.get('educationIndex');
  const index = educationIndex !== null ? Number(educationIndex) : 0;
  const user = getUser();
  const currentCount = user?.education?.length ?? 0;

  // Prevent adding beyond the max — only block new entries, not edits
  if (index >= MAX_EDUCATION_ENTRIES && index >= currentCount) {
    return redirect('/education-summary');
  }

  return null;
}

export async function clientAction({ request }: ClientActionFunctionArgs) {
  const formData = await request.formData();
  const url = new URL(request.url);
  const educationIndex = url.searchParams.get('educationIndex');
  const returnUrl = url.searchParams.get('returnUrl');
  const educationLevel = formData.get('educationLevel');
  try {
    const validatedData = EducationLevelSchema.parse(educationLevel);
    const index = educationIndex !== null ? Number(educationIndex) : undefined;
    updateUser('education', { educationLevel: validatedData }, index);
    const redirectUrl = addQueryParams('/education', {
      educationIndex,
      returnUrl,
    });
    return redirect(redirectUrl);
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
        callback={() => navigate(PREVIOUS_ROUTE)}
      />
    </Main>
  );
}

export default memo(EducationLevel);
