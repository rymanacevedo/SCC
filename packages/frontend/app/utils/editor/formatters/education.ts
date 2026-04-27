import type { User } from './../../user';

type Education = User['education'];
type EducationEntry = NonNullable<Education>[number];

export function formatEducationString(entry: EducationEntry): string {
  if (entry.educationLevel === 'Certificate') {
    return 'Certificate';
  }

  const primaryCredential =
    entry.degree === entry.educationLevel ? entry.educationLevel : entry.degree;

  return [
    primaryCredential,
    entry.degree === entry.educationLevel ? undefined : entry.educationLevel,
    entry.schoolName,
    entry.location,
  ]
    .filter(Boolean)
    .join(' | ');
}
