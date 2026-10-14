import type { User } from './user.ts';

export type ExperienceEntry = NonNullable<User['experience']>[number];

export function formatExperienceLocation(
  job: Pick<ExperienceEntry, 'city' | 'state'>,
): string {
  return [job.city, job.state].filter(Boolean).join(', ');
}

/** month: "March 2021"; year: "2021". Unparseable dates are shown as typed. */
function formatExperienceDate(value: string | undefined, style: DateStyle) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString('en-US', {
        month: style === 'month' ? 'long' : undefined,
        year: 'numeric',
        timeZone: 'UTC',
      });
}
type DateStyle = 'month' | 'year';

export function formatExperienceDateRange(
  job: Pick<ExperienceEntry, 'startDate' | 'endDate' | 'currentlyEmployed'>,
  style: DateStyle = 'month',
): string {
  const end = job.currentlyEmployed
    ? 'Present'
    : formatExperienceDate(job.endDate, style);
  return `${formatExperienceDate(job.startDate, style)} - ${end}`;
}
