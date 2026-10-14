import type { Handle } from 'remix/component';
import { HubLayout } from '../builder/hub-layout.tsx';
import type { BuilderPageProps } from '../builder/layout.tsx';
import {
  formatEducationCredential,
  getEducationGraduationLabel,
  sortEducationEntries,
} from '../education.ts';
import type { User } from '../user.ts';
export interface EducationHubProps extends BuilderPageProps {
  entries: NonNullable<User['education']>;
}
export function EducationSummaryPage(handle: Handle<EducationHubProps>) {
  return () => {
    const { entries, ...props } = handle.props;
    return (
      <HubLayout
        {...props}
        step="education-summary"
        title="Education summary"
        idField="educationId"
        addHref="/education-level"
        addLabel="+ Add another education entry"
        entries={sortEducationEntries(entries).map((entry) => ({
          id: entry.educationId,
          title: entry.schoolName || formatEducationCredential(entry),
          editHref: `/education-level?${new URLSearchParams({ educationId: entry.educationId, returnUrl: '/education-summary' })}`,
          details: (
            <div>
              <p className="italic">{formatEducationCredential(entry)}</p>
              <p>{getEducationGraduationLabel(entry)}</p>
            </div>
          ),
        }))}
      />
    );
  };
}
