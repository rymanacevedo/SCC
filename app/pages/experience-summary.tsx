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
      beforeForm={handle.props.entries.map((entry) => (
        <article key={entry.jobId}>
          <h2>
            {entry.jobTitle} at {entry.employer}
          </h2>
          <a
            href={`/experience?${new URLSearchParams({ jobId: entry.jobId, returnUrl: '/experience-summary' })}`}
          >
            Edit
          </a>
          <form
            method="post"
            action={`${handle.props.url.pathname}${handle.props.url.search}`}
          >
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="jobId" value={entry.jobId} />
            <button type="submit">Delete</button>
          </form>
        </article>
      ))}
    >
      <a href="/experience">Add another job</a>
    </BuilderLayout>
  );
}
