import {
  data,
  Form,
  NavLink,
  redirect,
  useLoaderData,
  useNavigate,
} from 'react-router';
import type { Route } from '../../+types/root';
import Button from '../../components/Button';
import Heading from '../../components/Heading';
import Main from '../../components/Main';
import { formatEducationString } from '../../utils/editor/formatters/education';
import {
  getEducationGraduationLabel,
  parseEducationIndexParam,
} from '../../utils/education';
import { addQueryParams } from '../../utils/navigation';
import {
  clearQueuedEducation,
  getRequiredUserTrait,
  getUser,
  setUser,
  updateUser,
} from '../../utils/user';

export { RouteErrorBoundary as ErrorBoundary } from '../../components/ErrorBoundaryContent';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const intent = formData.get('intent');
  const index = parseEducationIndexParam(formData.get('index')?.toString());
  const url = new URL(request.url);
  const returnUrl = url.searchParams.get('returnUrl');

  if (intent === 'delete' && typeof index === 'number') {
    const user = getUser();
    const currentEducation = user?.education || [];
    if (index < 0 || index >= currentEducation.length) {
      console.warn(`Invalid education index ${index}. Unable to delete.`);
      return data({ ok: false }, { status: 400 });
    }

    const nextEducation = [...currentEducation];
    nextEducation.splice(index, 1);

    if (user) {
      if (nextEducation.length === 0) {
        setUser({
          ...user,
          education: undefined,
        });
        return redirect(
          addQueryParams('/education-level', {
            returnUrl: returnUrl ?? null,
          }),
        );
      }

      updateUser('education', nextEducation);
    }

    return data({ ok: true });
  }

  return redirect(returnUrl ? returnUrl : '/skills');
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  clearQueuedEducation();
  const url = new URL(request.url);
  const returnUrl = url.searchParams.get('returnUrl');
  const user = getUser();

  if (!user?.education || user.education.length === 0) {
    return redirect(
      addQueryParams('/education-level', {
        returnUrl: returnUrl ?? null,
      }),
    );
  }

  const education = getRequiredUserTrait('education');

  return data({
    education,
    returnUrl,
  });
}

export default function EducationSummary() {
  const { education, returnUrl } = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();
  const canAddAnother = education.length < 3;
  const lastEducationIndex = education.length - 1;

  return (
    <Main>
      <Heading
        text="Education summary"
        level="h1"
        size="text-3xl"
        classNames="mb-2"
      />
      <div>
        {education.map((entry, index) => (
          <div
            key={`${entry.schoolName}-${entry.degree}-${entry.graduationDate ?? 'present'}`}
            className="border mb-4 pr-10 pl-14 pt-3 pb-3 rounded-md relative"
          >
            <span className="absolute left-0 top-0 border border-l-0 border-t-0 pt-2 pb-2 pr-4 pl-4 rounded">
              {index + 1}
            </span>
            <Heading level="h2" size="text-2xl" text={entry.schoolName} />
            <p className="italic">{formatEducationString(entry)}</p>
            <p>{getEducationGraduationLabel(entry)}</p>
            <div className="mt-4 flex gap-3">
              <NavLink
                className="underline"
                to={addQueryParams('/education-level', {
                  index: index.toString(),
                  returnUrl: returnUrl ?? null,
                })}
              >
                Edit
              </NavLink>
              <Form method="post">
                <input type="hidden" name="intent" value="delete" />
                <input type="hidden" name="index" value={index} />
                <button type="submit" className="underline">
                  Delete
                </button>
              </Form>
            </div>
          </div>
        ))}
      </div>

      {canAddAnother ? (
        <NavLink
          className="table mr-auto ml-auto w-full text-center p-4 border border-dashed mb-4"
          to={addQueryParams('/education-level', {
            returnUrl: returnUrl ?? null,
          })}
        >
          + Add another education entry
        </NavLink>
      ) : null}

      <Form method="post" className="flex justify-end space-x-5">
        {returnUrl ? (
          <Button action="submit" text="Resubmit" />
        ) : (
          <>
            <Button
              text="Previous"
              type="secondary"
              action="button"
              callback={() =>
                navigate(
                  addQueryParams('/education', {
                    index:
                      lastEducationIndex >= 0
                        ? lastEducationIndex.toString()
                        : null,
                    returnUrl: returnUrl ?? null,
                  }),
                )
              }
            />
            <Button action="submit" text="Next Step" />
          </>
        )}
      </Form>
    </Main>
  );
}
