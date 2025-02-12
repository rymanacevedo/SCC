import { memo } from 'react';
import Heading from '../../components/Heading';
import { getRequiredUserTrait } from '../../utils/user';
import { NavLink, useLoaderData } from 'react-router';

export async function clientLoader() {
  const experiences = getRequiredUserTrait('experience');
  return experiences;
}
function ExperienceSummary() {
  const ex = useLoaderData<typeof clientLoader>();
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
          <div
            className="border mb-4 pr-10 pl-14 pt-3 pb-3 rounded-md cursor-pointer 
          hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
            key={e.jobId}
          >
            <div className="">
              <span className="absolute left-0 top-0 border border-l-0 border-t-0 pt-2 pb-2 pr-4 pl-4 rounded">
                {index + 1}
              </span>
              <Heading level="h2" size="text-2xl" text={e.jobTitle} />
            </div>
            <em>{e.location}</em> |
            <em>
              {e.startDate} - {e.endDate}
            </em>
            <ul className="p-4 list-disc">
              {e.details?.map((d, index) => (
                <li key={`${e.jobId}-detail-${index}`}>{d}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* TODO: maintain consistent button styles */}
      <NavLink
        className="table mr-auto ml-auto w-full text-center p-4 border border-dashed"
        to="/experience"
      >
        + Add another position
      </NavLink>
      
    </main>
  );
}

export default memo(ExperienceSummary);
