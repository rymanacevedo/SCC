import { memo } from 'react';
import Heading from '../../components/Heading';
import { getRequiredUserTrait } from '../../utils/user';
import { useLoaderData } from 'react-router';

export async function clientLoader() {
  const { jobTitle } = getRequiredUserTrait('experience');
  // return results from an api call as well for what the jobtitle experience
  return {
    jobTitle,
  };
}
function ExperienceSummary() {
  const { jobTitle } = useLoaderData<typeof clientLoader>();
  return (
    <main className="max-w-6xl mx-auto">
      <Heading text="Work history summary" level="h1" size="text-2xl" />
    </main>
  );
}

export default memo(ExperienceSummary);
