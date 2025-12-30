import type { User } from './../../user';
type Education = User['education'];
export function formatEducationString(education: Education): string {
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
