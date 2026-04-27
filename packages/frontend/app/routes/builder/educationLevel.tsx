import { memo } from 'react';
import { data, Form, redirect, useLoaderData, useNavigate } from 'react-router';
import { z } from 'zod';
import type { Route } from '../../../.react-router/types/app/+types/root';
import Button from '../../components/Button';

export { RouteErrorBoundary as ErrorBoundary } from '../../components/ErrorBoundaryContent';

import { HeadingWithSubHeading } from '../../components/HeadingWithSubHeading';
import Main from '../../components/Main';
import { parseEducationIndexParam } from '../../utils/education';
import { addQueryParams } from '../../utils/navigation';
import { EducationLevelSchema } from '../../utils/schemas/education';
import {
  getEducationDetails,
  getQueuedEducation,
  setQueuedEducation,
} from '../../utils/user';

const educationLevels = EducationLevelSchema.options.map(
  (option) => option.value,
);

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const returnUrl = url.searchParams.get('returnUrl');
  const queuedEducation = getQueuedEducation();
  const index = parseEducationIndexParam(url.searchParams.get('index'));

  if (!queuedEducation && typeof index === 'number') {
    const education = getEducationDetails(index);
    if (education) {
      setQueuedEducation(education);
      return data({ index, returnUrl });
    }
  }

  return data({ index, returnUrl });
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const educationLevel = formData.get('educationLevel');
  const url = new URL(request.url);
  const index = parseEducationIndexParam(url.searchParams.get('index'));
  const returnUrl = url.searchParams.get('returnUrl');
  try {
    const validatedData = EducationLevelSchema.parse(educationLevel);
    const existingEducation =
      typeof index === 'number' ? getEducationDetails(index) : undefined;

    setQueuedEducation({
      ...existingEducation,
      educationLevel: validatedData,
    });

    return redirect(
      addQueryParams('/education', {
        index: typeof index === 'number' ? index.toString() : null,
        returnUrl: returnUrl ?? null,
      }),
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return data({ error: 'Something bad happened.' }, { status: 409 });
    }
  }
}

function EducationLevel() {
  const navigate = useNavigate();
  const { index, returnUrl } = useLoaderData<typeof clientLoader>();
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
        {typeof index === 'number' ? (
          <input type="hidden" name="index" value={index} />
        ) : null}
        {returnUrl ? (
          <input type="hidden" name="returnUrl" value={returnUrl} />
        ) : null}
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
