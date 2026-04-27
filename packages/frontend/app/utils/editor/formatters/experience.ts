import type { Experience } from './../../user';

export function formatExperienceLocation(
  experience: Pick<Experience, 'city' | 'state'>,
): string {
  return [experience.city, experience.state].filter(Boolean).join(', ');
}
