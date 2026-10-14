import {
  formatEducationCredential,
  getEducationGraduationLabel,
  sortEducationEntries,
} from '../education.ts';
import {
  formatExperienceDateRange,
  formatExperienceLocation,
} from '../experience.ts';
import type { Section, User } from '../user.ts';

export type BlockKind =
  | 'person-name'
  | 'contact-line'
  | 'section-title'
  | 'job-heading'
  | 'date-line'
  | 'paragraph'
  | 'bullet'
  | 'spacer';
export interface Block {
  kind: BlockKind;
  text: string;
  section: Section;
}
export type Outline = readonly Block[];

/** The sole description of Resume content and ordering; no surface styling. */
export function createOutline(user: User): Outline {
  const blocks: Block[] = [];
  const add = (section: Section, kind: BlockKind, text = '') =>
    blocks.push({ section, kind, text });
  if (user.info) {
    add('info', 'person-name', `${user.info.firstName} ${user.info.lastName}`);
    add(
      'info',
      'contact-line',
      [user.info.email, user.info.phone].filter(Boolean).join(' | '),
    );
    add('info', 'spacer');
  }
  if (user.summary) {
    add('summary', 'section-title', 'SUMMARY');
    add('summary', 'paragraph', user.summary.summary);
    add('summary', 'spacer');
  }
  if (user.skills) {
    add('skills', 'section-title', 'SKILLS');
    const skills = [...user.skills.expertRecommended, ...user.skills.other];
    if (skills.length) add('skills', 'paragraph', skills.join(', '));
    add('skills', 'spacer');
  }
  if (user.experience?.length) {
    add('experience', 'section-title', 'EXPERIENCE');
    for (const job of user.experience) {
      add(
        'experience',
        'job-heading',
        `${job.jobTitle} | ${job.employer} | ${formatExperienceLocation(job)}`,
      );
      add('experience', 'date-line', formatExperienceDateRange(job));
      for (const detail of job.details ?? [])
        add('experience', 'bullet', detail);
      add('experience', 'spacer');
    }
  }
  if (user.education?.length) {
    add('education', 'section-title', 'EDUCATION');
    for (const entry of sortEducationEntries(user.education)) {
      add('education', 'paragraph', formatEducationCredential(entry));
      add(
        'education',
        'date-line',
        `Graduation: ${getEducationGraduationLabel(entry) || 'N/A'}`,
      );
      add('education', 'spacer');
    }
  }
  return blocks;
}
