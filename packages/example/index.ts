import { buildGreeting } from './lib/greeting.ts';

export function formatGreeting(name: string): string {
  return buildGreeting(name);
}
