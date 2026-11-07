import { FLAGS_PATH } from './flags.ts';

/**
 * The app's page routes. A report's page URL is reduced to one of these
 * patterns, never to the path the browser was on, so the browser cannot
 * choose words that reach a GitHub issue (see ADR-0001). The app router is
 * checked against this list by a test (`app/routes.test.ts`).
 */
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

/**
 * The Worker's API routes, for Workers Logs paths. The Worker router is
 * checked against this list by a test (`worker/routes.test.ts`).
 */
export const API_ROUTE_PATTERNS = [
  '/api/errors',
  '/api/experience',
  FLAGS_PATH,
  '/api/report-issue',
  '/api/skills',
  '/api/summaries',
] as const;

/** What any path that is not a known route becomes. A valid URL path. */
export const UNKNOWN_ROUTE = '/[unknown-route]';

/**
 * The pattern a path is, ignoring one trailing slash, or `UNKNOWN_ROUTE`,
 * so a value such as `/experience/janedoe` is never kept.
 */
export function matchRoute(
  pathname: string,
  patterns: readonly string[],
): string {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  return patterns.find((pattern) => pattern === path) ?? UNKNOWN_ROUTE;
}

/**
 * The pattern an http(s) URL's path matches, or `UNKNOWN_ROUTE` for any
 * other path, any other scheme or a value that is not a URL.
 */
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
