import type { User } from './../../user';
type Info = User['info'];
export function formatInfoString(info: Info) {
  if (!info) return '';
  const location = [info.city, info.state].filter(Boolean).join(', ');
  const components = [info.email, info.phone].filter(Boolean).join(' | ');

  return components;
}
