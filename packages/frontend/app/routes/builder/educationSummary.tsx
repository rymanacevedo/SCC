import { memo } from 'react';
import {
  Form,
  NavLink,
  data,
  redirect,
  useLoaderData,
  useNavigate,
} from 'react-router';
import type { Route } from '../../+types/root';
import Button from '../../components/Button';
import Heading from '../../components/Heading';
import Main from '../../components/Main';
import { clearQueuedEducation, getRequiredUserTrait } from '../../utils/user';

const MAX_EDUCATION_ENTRIES = 3;

export async function clientAction({ request }: Route.ClientActionArgs) {
  const url = new URL(request.url);
  const returnUrl = url.searchParams.get('returnUrl');

  const redirectUrl = returnUrl ? returnUrl : '/skills';
  return redirect(redirectUrl);
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  clearQueuedEducation();
  const url = new URL(request.url);
  const returnUrl = url.searchParams.get('returnUrl');
  const educationEntries = getRequiredUserTrait('education');

  return data({
    educationEntries,
    returnUrl,
  });
}

function EducationSummary() {
  const { educationEntries, returnUrl } = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();
  return (
    <Main>
      <Heading
        text="Education summary"
        level="h1"
        size="text-3xl"
        classNames="mb-2"
      />
      <div>
        {educationEntries.map((entry, index) => (
          <NavLink
            to={{
              pathname: '/education-level',
              search: returnUrl
                ? `?returnUrl=${encodeURIComponent(returnUrl)}`
                : undefined,
            }}
            key={`${entry.schoolName}-${entry.degree}-${entry.educationLevel}`}
          >
            <div
              className="border mb-4 pr-10 pl-14 pt-3 pb-3 rounded-md cursor-pointer
          hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
            >
              <div>
                <span className="absolute left-0 top-0 border border-l-0 border-t-0 pt-2 pb-2 pr-4 pl-4 rounded">
                  {index + 1}
                </span>
                <Heading
                  level="h2"
                  size="text-2xl"
                  text={entry.schoolName || 'School'}
                />
              </div>
              <em>{entry.educationLevel}</em>
              {entry.degree &&
                entry.degree !== 'Diploma' &&
                entry.degree !== 'Certificate' && (
                  <>
                    <span> | </span>
                    <em>{entry.degree}</em>
                  </>
                )}
              {entry.location && (
                <>
                  <span> | </span>
                  <em>{entry.location}</em>
                </>
              )}
              <span> | </span>
              <em>
                {entry.currentlyEnrolled
                  ? 'Currently Enrolled'
                  : entry.graduationDate || 'N/A'}
              </em>
            </div>
          </NavLink>
        ))}
      </div>

      {educationEntries.length < MAX_EDUCATION_ENTRIES && (
        <NavLink
          className="table mr-auto ml-auto w-full text-center p-4 border border-dashed mb-4"
          to="/education-level"
        >
          + Add another education
        </NavLink>
      )}
      <Form method="post" className="flex justify-end space-x-5">
        {returnUrl ? (
          <Button action="submit" text="Resubmit" />
        ) : (
          <>
            <Button
              text="Previous"
              type="secondary"
              action="button"
              callback={() => navigate('/education')}
            />
            <Button action="submit" text="Next Step" />
          </>
        )}
      </Form>
    </Main>
  );
}

export default memo(EducationSummary);
