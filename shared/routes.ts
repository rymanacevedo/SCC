import { FLAGS_PATH } from './flags.ts';

export const APP_ROUTE_PATTERNS = [
  '/',
  '/education',
  '/education-entry',
  '/education-level',
  '/education-summary',
  '/experience',
  '/experience-entry',
  '/experience-summary',
  '/finish-up',
  '/info',
  '/resume',
  '/skills',
  '/summary',
] as const;

export const API_ROUTE_PATTERNS = [
  '/api/errors',
  '/api/experience',
  FLAGS_PATH,
  '/api/report-issue',
  '/api/skills',
  '/api/summaries',
] as const;

export const UNKNOWN_ROUTE = '/[unknown-route]';

export function matchRoute(
  pathname: string,
  patterns: readonly string[],
): string {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  return patterns.find((pattern) => pattern === path) ?? UNKNOWN_ROUTE;
}

export function routeOf(value: string, patterns: readonly string[]): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return UNKNOWN_ROUTE;
  }
  return url.protocol === 'http:' || url.protocol === 'https:'
    ? matchRoute(url.pathname, patterns)
    : UNKNOWN_ROUTE;
}
