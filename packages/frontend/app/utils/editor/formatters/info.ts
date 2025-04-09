import type { User } from './../../user';
type Info = User['info'];
export function formatInfoString(info: Info) {
  const location = [info.city, info.state].filter(Boolean).join(', ');
  const components = [info.email, info.phone, location]
    .filter(Boolean)
    .join(' | ');

  return components;
}
