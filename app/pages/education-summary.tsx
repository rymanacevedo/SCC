import type { Handle } from 'remix/component';
import { BuilderLayout, type BuilderPageProps } from '../builder/layout.tsx';
import {
  getEducationGraduationLabel,
  sortEducationEntries,
} from '../education.ts';
import type { User } from '../user.ts';
export interface EducationHubProps extends BuilderPageProps {
  entries: NonNullable<User['education']>;
}
export function EducationSummaryPage(handle: Handle<EducationHubProps>) {
  return () => (
    <BuilderLayout
      {...handle.props}
      step="education-summary"
      title="Your education"
      beforeForm={sortEducationEntries(handle.props.entries).map((entry) => (
        <article key={entry.educationId}>
          <h2>{entry.schoolName}</h2>
          <p>
            {entry.degree} {entry.location}
          </p>
          <p>{getEducationGraduationLabel(entry)}</p>
          <a
            href={`/education-level?${new URLSearchParams({ educationId: entry.educationId, returnUrl: '/education-summary' })}`}
          >
            Edit
          </a>
          <form
            method="post"
            action={`${handle.props.url.pathname}${handle.props.url.search}`}
          >
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="educationId" value={entry.educationId} />
            <button type="submit">Delete</button>
          </form>
        </article>
      ))}
    >
      <a href="/education-level">Add another school</a>
    </BuilderLayout>
  );
}
