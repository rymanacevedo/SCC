import { data, redirect, useFetcher, useLoaderData } from 'react-router';
import { Form, useActionData } from 'react-router';
import { z } from 'zod';
import type { Route } from '../../../.react-router/types/app/+types/root';
import Button from '../../components/Button';
import Heading from '../../components/Heading';
import Loading from '../../components/Loading';
import Main from '../../components/Main';
import useEffectOnce from '../../hooks/useEffectOnce';
import { getUser, updateUser } from '../../utils/user';
import { HeadingWithSubHeading } from '../../components/HeadingWithSubHeading';
import type { FormErrors } from '../../components/Input';

export const SummarySchema = z.object({
  summary: z.string().min(50, 'Summary should be at least 50 characters'),
});

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const entries = Object.fromEntries(formData);
  const url = new URL(request.url);
  const returnUrl = url.searchParams.get('returnUrl');
  const redirectUrl = returnUrl ? returnUrl : '/finish-up';

  try {
    const validatedData = SummarySchema.parse(entries);
    updateUser('summary', validatedData);

    return redirect(redirectUrl);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return data(
        { errors: error.flatten().fieldErrors as FormErrors },
        { status: 400 },
      );
    }
    return data(
      { errors: { _form: ['An errored occured.'] } as FormErrors },
      { status: 409 },
    );
  }
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const user = getUser();
  const url = new URL(request.url);
  const returnUrl = url.searchParams.get('returnUrl');

  if (user?.experience) {
    const experienceString = user.experience
      .map(
        (job) =>
          `<job>
            <jobTitle>${job.jobTitle}</jobTitle> <employer>${job.employer}</employer>
            <details>
            ${job.details
            ?.map(
              (detail, index) => `
                  <detail${index + 1}>${detail}</detail${index + 1}>`,
            )
            .join('')}
            </details>
          </job>`,
      )
      .join('');

    return data({
      prevSummary: user?.summary?.summary,
      experienceString,
      returnUrl,
    });
  }

  return data({
    prevSummary: user?.summary?.summary,
    returnUrl,
    experienceString: undefined,
  });
}

export default function Summary() {
  const actionData = useActionData<typeof clientAction>();
  const errors = actionData?.errors;
  const { prevSummary, returnUrl, experienceString } =
    useLoaderData<typeof clientLoader>();
  const fetcher = useFetcher<{ text: string; title: string }[]>();

  useEffectOnce(() => {
    if (fetcher.state === 'idle' && !fetcher.data) {
      const formData = new FormData();
      if (experienceString) {
        formData.set('jobSearch', experienceString);
        fetcher.submit(formData, {
          method: 'POST',
          action: '/api/summary',
        });
      }
    }
  });

  return (
    <Main>
      <HeadingWithSubHeading
        firstHeading="Create Your Professional Summary"
        secondHeading="Write a compelling summary that highlights your key achievements and
          career goals. This is often the first thing employers read."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
        {/* Left Column - Writing Area */}
        <div className="order-2 md:order-1">
          <Form method="post" className="space-y-6">
            <div>
              <label
                htmlFor="summary"
                className="block text-sm font-medium dark:text-white text-gray-700 mb-2"
              >
                Professional Summary
              </label>
              <textarea
                id="summary"
                name="summary"
                rows={8}
                defaultValue={prevSummary}
                className="w-full border rounded-md shadow-sm p-3"
                placeholder="Write a professional summary that highlights your key skills and experience..."
              />
              {errors?.summary ? (
                <p className="mt-1 text-sm text-red-600">{errors.summary[0]}</p>
              ) : null}
              <p className="mt-2 text-sm dark:text-gray-400 text-gray-600">
                Aim for 3-5 sentences that capture your strongest
                qualifications.
              </p>
            </div>

            {/* Tips */}
            <div className="bg-blue-50 p-4 rounded-md">
              <Heading
                text="Writing Tips"
                level="h2"
                size="text-base"
                color="text-blue-800"
                classNames="mb-2 font-medium"
              />
              <ul className="text-sm text-blue-700 space-y-2">
                <li>
                  Start with your professional title and years of experience
                </li>
                <li>Highlight 2-3 key achievements or skills</li>
                <li>Mention your career goals or what you're looking for</li>
                <li>Keep it concise and focused</li>
              </ul>
            </div>
            {/* Navigation Buttons */}
            <div className="flex justify-between pt-4">
              {returnUrl ? (
                <Button action="submit" text="Resubmit" />
              ) : (
                <>
                  <Button
                    text="Previous"
                    type="secondary"
                    action="button"
                    callback={() => window.history.back()}
                  />
                  <Button action="submit" text="Next Step" />
                </>
              )}
            </div>
          </Form>
        </div>

        {/* Right Column - Examples */}
        <div className="order-1 md:order-2">
          <Heading
            text="Example Summaries"
            level="h2"
            size="text-lg"
            classNames="mb-4"
          />
          <div className="space-y-4">
            <Loading fetcher={fetcher}>
              {fetcher.data?.map((example) => (
                <button
                  type="button"
                  key={example.text}
                  className="text-left border p-4 rounded-md cursor-pointer 
            hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => {
                    const textarea = document.getElementById(
                      'summary',
                    ) as HTMLTextAreaElement;
                    if (textarea) {
                      textarea.value = example.text;
                    }
                  }}
                >
                  <Heading
                    text={example.title}
                    level="h3"
                    size="text-base"
                    classNames="mb-2"
                  />
                  <p className="text-sm dark:text-gray-400 text-gray-600">
                    {example.text}
                  </p>
                </button>
              ))}
            </Loading>
          </div>
        </div>
      </div>
    </Main>
  );
}
