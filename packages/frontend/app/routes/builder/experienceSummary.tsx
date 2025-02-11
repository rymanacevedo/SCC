import { memo } from 'react';
import Heading from '../../components/Heading';
import { getRequiredUserTrait } from '../../utils/user';
import { useLoaderData } from 'react-router';

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
        <>
          <Heading key={e.jobId} level="h2" size="text-2xl" text={e.jobTitle} />
          <em key={e.jobId}>{e.location}</em> |
          <em key={e.jobId}>
            {e.startDate} - {e.endDate}
          </em>
          <ul className="p-3 list-disc" key={e.jobId}>
            {e.details?.map((d, index) => (
              <li key={`${e.jobId}-detail-${index}`}>{d}</li>
            ))}
          </ul>
        </>
      ))}
    </main>
  );
}

export default memo(ExperienceSummary);
