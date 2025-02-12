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
      <Heading text="Work history summary" level="h1" size="text-3xl" />
      {ex.map((e) => (
        <div key={e.jobId}>
          <Heading level="h2" size="text-2xl" text={e.jobTitle} />
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

      <NavLink to="/experience">Add another position</NavLink>
    </main>
  );
}

export default memo(ExperienceSummary);
