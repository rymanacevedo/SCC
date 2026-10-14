import { findEducationEntry } from './education.ts';
import type { Drafts, Section, User } from './user.ts';

type Prerequisite = Section | 'experienceDraft' | 'educationDraft';
export interface Step {
  id: string;
  path: string;
  section: Section | null;
  label: string;
  prerequisites: readonly Prerequisite[];
}
export const steps = [
  {
    id: 'info',
    path: '/info',
    section: 'info',
    label: 'Info',
    prerequisites: [],
  },
  {
    id: 'experience',
    path: '/experience',
    section: 'experience',
    label: 'Experience',
    prerequisites: ['info'],
  },
  {
    id: 'experience-entry',
    path: '/experience-entry',
    section: 'experience',
    label: 'Experience details',
    prerequisites: ['info', 'experienceDraft'],
  },
  {
    id: 'experience-summary',
    path: '/experience-summary',
    section: 'experience',
    label: 'Experience entries',
    prerequisites: ['info', 'experience'],
  },
  {
    id: 'education-level',
    path: '/education-level',
    section: 'education',
    label: 'Education level',
    prerequisites: ['info', 'experience'],
  },
  {
    id: 'education',
    path: '/education',
    section: 'education',
    label: 'Education',
    prerequisites: ['info', 'experience', 'educationDraft'],
  },
  {
    id: 'education-entry',
    path: '/education-entry',
    section: 'education',
    label: 'Education details',
    prerequisites: ['info', 'experience', 'educationDraft'],
  },
  {
    id: 'education-summary',
    path: '/education-summary',
    section: 'education',
    label: 'Education entries',
    prerequisites: ['info', 'experience', 'education'],
  },
  {
    id: 'skills',
    path: '/skills',
    section: 'skills',
    label: 'Skills',
    prerequisites: ['info', 'experience', 'education'],
  },
  {
    id: 'summary',
    path: '/summary',
    section: 'summary',
    label: 'Summary',
    prerequisites: ['info', 'experience', 'education', 'skills'],
  },
  {
    id: 'finish-up',
    path: '/finish-up',
    section: null,
    label: 'Finish up',
    prerequisites: ['info', 'experience', 'education', 'skills', 'summary'],
  },
  {
    id: 'resume',
    path: '/resume',
    section: null,
    label: 'Preview',
    prerequisites: ['info', 'experience', 'education', 'skills', 'summary'],
  },
] as const satisfies readonly Step[];
export type StepId = (typeof steps)[number]['id'];
/** Only root-relative paths are accepted; URL parsing also rejects backslash escapes. */
export function validatedReturnUrl(url: URL): string | undefined {
  const value = url.searchParams.get('returnUrl');
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    [...value].some(
      (character) => character === '\\' || character.charCodeAt(0) <= 32,
    )
  )
    return undefined;
  try {
    return new URL(value, url).origin === url.origin ? value : undefined;
  } catch {
    return undefined;
  }
}
export function builderNav(id: StepId, url: URL) {
  const index = steps.findIndex((step) => step.id === id);
  let previous: string = index > 0 ? steps[index - 1].path : '/';
  if (
    (id === 'education' || id === 'education-entry') &&
    url.searchParams.has('educationId')
  ) {
    previous = `${id === 'education' ? '/education-level' : '/education'}?${new URLSearchParams({ educationId: url.searchParams.get('educationId')! })}`;
  }
  if (id === 'experience-entry' && url.searchParams.has('jobId')) {
    const params = new URLSearchParams({
      jobId: url.searchParams.get('jobId') ?? '',
    });
    previous = `/experience?${params}`;
  }
  return {
    previous,
    next: steps[index + 1]?.path ?? '/',
    returnUrl: validatedReturnUrl(url),
  };
}
export function guardStep(
  id: StepId,
  user: User,
  drafts: Drafts = {},
): string | undefined {
  const step: Step = steps.find((step) => step.id === id)!;
  for (const prerequisite of step.prerequisites) {
    if (prerequisite === 'experienceDraft') {
      if (!drafts.experience) return '/experience';
    } else if (prerequisite === 'educationDraft') {
      if (!drafts.education) return '/education-level';
    } else if (user[prerequisite] === undefined) {
      return steps.find((candidate) => candidate.section === prerequisite)!
        .path;
    }
  }
}

/** Initial SPA reloads follow redirects without updating the browser address. */
export function guardInitialUrl(
  url: URL,
  user: User,
  drafts: Drafts,
  available: readonly StepId[],
): string | undefined {
  const step = steps.find(
    (step) => step.path === url.pathname && available.includes(step.id),
  );
  if (
    step &&
    ['education-level', 'education', 'education-entry'].includes(step.id)
  ) {
    const target = guardStep('education-level', user, drafts);
    if (target) return target;
    const id = url.searchParams.get('educationId');
    const entry = findEducationEntry(user, drafts, id);
    if (id && !entry) return '/education-summary';
    if (
      step.id !== 'education-level' &&
      (!entry?.educationLevel || !entry?.educationId)
    )
      return '/education-level';
    if (step.id === 'education-entry' && !entry?.schoolName) {
      return id
        ? `/education?${new URLSearchParams({ educationId: id })}`
        : '/education';
    }
    return undefined;
  }
  if (step?.id === 'experience-entry') {
    const missingInfo = guardStep('experience', user, drafts);
    if (missingInfo) return missingInfo;
    const id = url.searchParams.get('jobId');
    const hasDraft = Boolean(id && drafts.experience?.jobId === id);
    const hasEntry = user.experience?.some((job) => job.jobId === id);
    if (hasDraft || hasEntry) return undefined;
    return '/experience-summary';
  }
  return step ? guardStep(step.id, user, drafts) : undefined;
}
