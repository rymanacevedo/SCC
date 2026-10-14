import type { Handle } from 'remix/component';
import { BuilderLayout, type BuilderPageProps } from '../builder/layout.tsx';
import type { User } from '../user.ts';
export interface ExperienceHubProps extends BuilderPageProps {
  entries: NonNullable<User['experience']>;
}
export function ExperienceSummaryPage(handle: Handle<ExperienceHubProps>) {
  return () => (
    <BuilderLayout
      {...handle.props}
      step="experience-summary"
      title="Your experience"
    >
      {handle.props.entries.map((entry) => (
        <article key={entry.jobId}>
          <h2>
            {entry.jobTitle} at {entry.employer}
          </h2>
          <a
            href={`/experience?${new URLSearchParams({ jobId: entry.jobId, returnUrl: '/experience-summary' })}`}
          >
            Edit
          </a>
          <button type="submit" name="deleteId" value={entry.jobId}>
            Delete
          </button>
        </article>
      ))}
      <a href="/experience">Add another job</a>
    </BuilderLayout>
  );
}
