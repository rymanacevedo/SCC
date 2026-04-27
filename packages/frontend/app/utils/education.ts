import type { z } from 'zod';
import type {
  BaseEducationSchema,
  EducationLevelSchema,
} from './schemas/education';

export type EducationEntry = z.infer<typeof BaseEducationSchema>;
export type PartialEducationEntry = Partial<EducationEntry>;
export type EducationLevel = z.infer<typeof EducationLevelSchema>;

const diplomaEducationLevels = new Set<EducationLevel>([
  'GED',
  'High School',
  'Some College',
]);

export function isDiplomaEducationLevel(level?: string | null) {
  return level ? diplomaEducationLevels.has(level as EducationLevel) : false;
}

export function isCertificateEducationLevel(level?: string | null) {
  return level === 'Certificate';
}

export function parseEducationIndexParam(
  value: string | null | undefined,
): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function normalizeEducationEntry(
  education: PartialEducationEntry,
): PartialEducationEntry {
  const educationLevel = education.educationLevel;

  if (isCertificateEducationLevel(educationLevel)) {
    return {
      ...education,
      degree: 'Certificate',
      location: education.location?.trim() ?? '',
    };
  }

  if (isDiplomaEducationLevel(educationLevel)) {
    return {
      ...education,
      degree: 'Diploma',
    };
  }

  return education;
}

export function sortEducationEntries<T extends PartialEducationEntry>(
  education: T[],
): T[] {
  return [...education].sort((a, b) => {
    if (a.currentlyEnrolled && !b.currentlyEnrolled) return -1;
    if (!a.currentlyEnrolled && b.currentlyEnrolled) return 1;

    const aYear = a.graduationDate ? Number.parseInt(a.graduationDate, 10) : -1;
    const bYear = b.graduationDate ? Number.parseInt(b.graduationDate, 10) : -1;

    return bYear - aYear;
  });
}

export function getEducationGraduationLabel(education: PartialEducationEntry) {
  return education.currentlyEnrolled
    ? 'Currently Enrolled'
    : education.graduationDate;
}
