import { memo } from 'react';
import Heading from '../../components/Heading';
import { clearQueuedExperience, getRequiredUserTrait } from '../../utils/user';
import {
  Form,
  NavLink,
  redirect,
  useLoaderData,
  useNavigate,
} from 'react-router';
import Button from '../../components/Button';

export async function clientAction() {
  return redirect('/education-level');
}

export async function clientLoader() {
  clearQueuedExperience();
  const experiences = getRequiredUserTrait('experience');
  return experiences;
}
function ExperienceSummary() {
  const ex = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();
  return (
    <main className="max-w-6xl mx-auto">
      <Heading
        text="Work history summary"
        level="h1"
        size="text-3xl"
        classNames="mb-2"
      />
      <div>
        {ex.map((e, index) => (
          <NavLink
            to={{
              pathname: '/experience',
              search: `?jobId=${encodeURIComponent(e.jobId)}`,
            }}
            key={e.jobId}
          >
            <div
              className="border mb-4 pr-10 pl-14 pt-3 pb-3 rounded-md cursor-pointer 
          hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
            >
              <div>
                <span className="absolute left-0 top-0 border border-l-0 border-t-0 pt-2 pb-2 pr-4 pl-4 rounded">
                  {index + 1}
                </span>
                <Heading level="h2" size="text-2xl" text={e.jobTitle} />
              </div>
              <em>{e.location}</em>
              <span> | </span>
              <em>
                {e.startDate.getUTCFullYear().toString()}
                <span> - </span>
                {e.endDate ? e.endDate.getUTCFullYear() : 'Present'}
              </em>
              <ul className="p-4 list-disc">
                {e.details?.map((d, index) => (
                  <li key={`${e.jobId}-detail-${index}`}>{d}</li>
                ))}
              </ul>
            </div>
          </NavLink>
        ))}
      </div>

      {/* TODO: maintain consistent button styles */}
      <NavLink
        className="table mr-auto ml-auto w-full text-center p-4 border border-dashed mb-4"
        to="/experience"
      >
        + Add another position
      </NavLink>
      <Form method="post" className="flex justify-end space-x-5">
        <Button
          text="Previous"
          type="secondary"
          action="button"
          callback={() =>
            navigate(
              `/experience-entry?jobId=${encodeURIComponent(ex[ex.length - 1]?.jobId)}`,
            )
          }
        />

        <Button action="submit" text="Next Step" />
      </Form>
    </main>
  );
}

export default memo(ExperienceSummary);
