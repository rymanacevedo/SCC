import type { Handle } from 'remix/component';
import { HubLayout } from '../builder/hub-layout.tsx';
import type { BuilderPageProps } from '../builder/layout.tsx';
import {
  formatExperienceDateRange,
  formatExperienceLocation,
} from '../experience.ts';
import type { User } from '../user.ts';
export interface ExperienceHubProps extends BuilderPageProps {
  entries: NonNullable<User['experience']>;
}
export function ExperienceSummaryPage(handle: Handle<ExperienceHubProps>) {
  return () => {
    const { entries, ...props } = handle.props;
    return (
      <HubLayout
        {...props}
        step="experience-summary"
        title="Work history summary"
        idField="jobId"
        addHref="/experience"
        addLabel="+ Add another position"
        entries={entries.map((entry) => ({
          id: entry.jobId,
          title: entry.jobTitle,
          editHref: `/experience?${new URLSearchParams({ jobId: entry.jobId, returnUrl: '/experience-summary' })}`,
          details: (
            <div>
              <p className="italic">
                {[entry.employer, formatExperienceLocation(entry)]
                  .filter(Boolean)
                  .join(' • ')}
                {' | '}
                {formatExperienceDateRange(entry, 'year')}
              </p>
              {entry.details?.length ? (
                <ul className="list-disc p-4">
                  {entry.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ),
        }))}
      />
    );
  };
}
