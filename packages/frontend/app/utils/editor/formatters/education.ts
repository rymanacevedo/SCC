import type { User } from './../../user';
type EducationEntry = NonNullable<User['education']>[number];
export function formatEducationString(
  education: EducationEntry | undefined,
): string {
  if (!education) return '';
  const components = [
    education.degree,
    education.educationLevel,
    education.schoolName,
    education.location,
  ]
    .filter(Boolean)
    .join(' | ');

  return components;
}
