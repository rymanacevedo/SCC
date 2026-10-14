import type { Handle } from 'remix/component';
import type { RemixNode } from 'remix/component/jsx-runtime';
import { BuilderLayout, type BuilderPageProps } from '../builder/layout.tsx';
import { StartOver } from '../builder/start-over.tsx';
import {
  getEducationGraduationLabel,
  sortEducationEntries,
} from '../education.ts';
import {
  formatExperienceDateRange,
  formatExperienceLocation,
} from '../experience.ts';
import { cardClass } from '../ui/card.tsx';
import { Chip } from '../ui/chip.tsx';
import { TextLink } from '../ui/link.tsx';
import type { Section, User } from '../user.ts';
export interface FinishUpProps extends BuilderPageProps {
  completed: { section: Section; label: string; path: string }[];
  user: User;
}

/** The review card's order and headings, as on the old finish-up page. */
const review: { section: Section; title: string }[] = [
  { section: 'info', title: 'Personal Information' },
  { section: 'summary', title: 'Professional Summary' },
  { section: 'experience', title: 'Job Experience' },
  { section: 'education', title: 'Education' },
  { section: 'skills', title: 'Skills' },
];

function Detail(handle: Handle<{ label: string; children?: RemixNode }>) {
  return () => (
    <div>
      <h3 className="text-sm text-gray-500">{handle.props.label}</h3>
      <p className="font-medium">{handle.props.children}</p>
    </div>
  );
}

function SectionContent(handle: Handle<{ section: Section; user: User }>) {
  return () => {
    const { section, user } = handle.props;
    switch (section) {
      case 'info': {
        const info = user.info;
        return (
          <div className="grid grid-cols-2 gap-4">
            <Detail label="Name">
              {info?.firstName} {info?.lastName}
            </Detail>
            <Detail label="Location">
              {[info?.city, info?.state].filter(Boolean).join(', ')}{' '}
              {info?.zipCode}
            </Detail>
            <Detail label="Phone">{info?.phone}</Detail>
            <Detail label="Email">{info?.email}</Detail>
          </div>
        );
      }
      case 'summary':
        return <p className="text-gray-600">{user.summary?.summary}</p>;
      case 'experience':
        return (
          <div className="divide-y divide-gray-200">
            {user.experience?.map((job) => (
              <div key={job.jobId} className="py-4">
                <div className="mb-1 flex justify-between gap-4">
                  <span className="font-medium text-gray-900">
                    {job.jobTitle}
                  </span>
                  <span className="text-sm text-gray-500">
                    {formatExperienceDateRange(job)}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  {[job.employer, formatExperienceLocation(job)]
                    .filter(Boolean)
                    .join(' • ')}
                </div>
                {job.details?.length ? (
                  <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-gray-600">
                    {job.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        );
      case 'education':
        return (
          <div className="space-y-4">
            {sortEducationEntries(user.education ?? []).map((entry) => (
              <div key={entry.educationId}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Detail label="School">{entry.schoolName}</Detail>
                  <Detail label="Graduation">
                    {getEducationGraduationLabel(entry)}
                  </Detail>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <Detail label="Level">{entry.educationLevel}</Detail>
                  <Detail label="Degree">{entry.degree}</Detail>
                </div>
                {entry.location ? (
                  <div className="mt-3">
                    <Detail label="Location">{entry.location}</Detail>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        );
      case 'skills':
        return (
          <div className="flex flex-wrap gap-2">
            {[
              ...(user.skills?.expertRecommended ?? []),
              ...(user.skills?.other ?? []),
            ].map((skill) => (
              <Chip key={skill}>{skill}</Chip>
            ))}
          </div>
        );
    }
  };
}

export function FinishUpPage(handle: Handle<FinishUpProps>) {
  return () => {
    const { completed, user } = handle.props;
    const sections = review.flatMap(({ section, title }) => {
      const done = completed.find((entry) => entry.section === section);
      return done ? [{ ...done, title }] : [];
    });
    return (
      <div className="mx-auto max-w-4xl">
        <BuilderLayout
          {...handle.props}
          step="finish-up"
          title="Review Your Resume"
          subtitle="Review and edit your information before finalizing your resume."
          beforeForm={
            sections.length ? (
              <div className={cardClass('raised', 'mb-6')}>
                {sections.map(({ section, label, path, title }) => (
                  <section
                    key={section}
                    aria-label={title}
                    className="border-b p-6 last:border-b-0"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-gray-900">
                        {title}
                      </h2>
                      <TextLink
                        href={`${path}?${new URLSearchParams({ returnUrl: '/finish-up' })}`}
                        aria-label={`Edit ${label}`}
                      >
                        Edit
                      </TextLink>
                    </div>
                    <SectionContent section={section} user={user} />
                  </section>
                ))}
              </div>
            ) : null
          }
        >
          {null}
        </BuilderLayout>
        <StartOver action="/finish-up" />
      </div>
    );
  };
}
