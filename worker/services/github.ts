import {
  buildTelemetryFingerprint,
  type ErrorTelemetryPayload as ErrorTelemetry,
  errorTelemetrySchema,
  type UserIssueReportPayload as UserIssueReport,
  userIssueReportSchema,
} from '../../shared/errorReporting.ts';
import { truncateText } from '../../shared/text.ts';
import { readBoundedText } from '../lib/body.ts';
import { UpstreamTimeoutError, withDeadline } from '../lib/deadline.ts';

export type { ErrorTelemetry, UserIssueReport };
export { errorTelemetrySchema, userIssueReportSchema };

const GITHUB_ISSUE_TITLE_MAX = 256;
/** GitHub refuses an issue body longer than this many characters. */
export const GITHUB_ISSUE_BODY_MAX = 65_536;
const AUTO_REPORTED_TITLE_PREFIX = 'Auto-reported error: ';
const GITHUB_ERROR_BODY_SNIPPET_MAX = 300;
const GITHUB_USER_AGENT = 'scc-backend-worker';
const FINGERPRINT_LABEL = '- Fingerprint: ';
const GITHUB_ISSUES_PAGE_SIZE = 100;
/**
 * Longest one GitHub API call may take, response body included. GitHub
 * answers in well under a second; past this it is degraded, and holding the
 * request open would not help.
 */
export const GITHUB_REQUEST_DEADLINE_MS = 10_000;

export type GitHubIssueCreationErrorKind = 'http' | 'network' | 'timeout';

export class GitHubIssueCreationError extends Error {
  kind: GitHubIssueCreationErrorKind;
  status?: number;
  details?: string;

  constructor(
    message: string,
    options: {
      kind: GitHubIssueCreationErrorKind;
      status?: number;
      details?: string;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = 'GitHubIssueCreationError';
    this.kind = options.kind;
    this.status = options.status;
    this.details = options.details;
  }
}

/**
 * The fingerprint an issue body carries and deduplication searches for: the
 * SHA-256 hex digest of the complete telemetry fingerprint. A fixed 64
 * characters however long or escape-heavy the report, so it never crowds the
 * body past GitHub's limit, and distinct reports never share a prefix match.
 * Issues filed before the digest carried the raw JSON; deduplication still
 * matches that legacy form (see `fingerprintMarkers`).
 */
export async function issueFingerprint(payload: ErrorTelemetry) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(buildTelemetryFingerprint(payload)),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export function buildAutoReportedIssueBody(
  payload: ErrorTelemetry,
  fingerprint: string,
) {
  return [
    '# Auto-reported application error',
    '',
    `${FINGERPRINT_LABEL}${fingerprint}`,
    `- Timestamp: ${payload.timestamp}`,
    `- URL: ${payload.url}`,
    `- Message: ${payload.message}`,
    '',
    '## Stack trace',
    '```',
    payload.stackTrace ?? 'No stack trace available.',
    '```',
  ].join('\n');
}

export function buildUserReportedIssueBody(payload: UserIssueReport) {
  return [
    '# User-reported issue',
    '',
    `- Timestamp: ${payload.timestamp}`,
    `- URL: ${payload.url}`,
    '',
    '## Description',
    payload.description,
  ].join('\n');
}

// A UTF-8 character is at most 4 bytes, so this many bytes always covers the snippet.
const GITHUB_ERROR_BODY_SNIPPET_BYTES = GITHUB_ERROR_BODY_SNIPPET_MAX * 4;

/** Keeps the start of a GitHub error body without buffering the rest of it. */
async function readErrorSnippet(response: Response) {
  const { text } = await readBoundedText(
    response.body,
    GITHUB_ERROR_BODY_SNIPPET_BYTES,
  );
  return text.slice(0, GITHUB_ERROR_BODY_SNIPPET_MAX);
}

/**
 * The one way the service calls GitHub: under `GITHUB_REQUEST_DEADLINE_MS`,
 * with failures classified by kind. Never retries, so a creation that timed
 * out (and may have landed) is never sent twice.
 */
async function requestGitHub<T>({
  action,
  token,
  path,
  method,
  body,
  read,
}: {
  /** Names the call in error messages, e.g. `issue creation`. */
  action: string;
  token: string;
  /** Path under `https://api.github.com`, query string included. */
  path: string;
  method: 'GET' | 'POST';
  /** Sent as JSON. */
  body?: unknown;
  read: (response: Response) => Promise<T>;
}): Promise<T> {
  const init: RequestInit = {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': GITHUB_USER_AGENT,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
  try {
    return await withDeadline(
      { upstream: 'github', timeoutMs: GITHUB_REQUEST_DEADLINE_MS },
      async (signal) => {
        let response: Response;
        try {
          response = await fetch(`https://api.github.com${path}`, {
            ...init,
            signal,
          });
        } catch (error) {
          throw new GitHubIssueCreationError(
            `GitHub ${action} request failed.`,
            { kind: 'network', cause: error },
          );
        }
        if (!response.ok) {
          const details = await readErrorSnippet(response);
          throw new GitHubIssueCreationError(`GitHub ${action} failed.`, {
            kind: 'http',
            status: response.status,
            details,
          });
        }
        return read(response);
      },
    );
  } catch (error) {
    if (error instanceof UpstreamTimeoutError) {
      throw new GitHubIssueCreationError(`GitHub ${action} timed out.`, {
        kind: 'timeout',
        cause: error,
      });
    }
    throw error;
  }
}

async function createGitHubIssue({
  repo,
  token,
  title,
  body,
  labels,
}: {
  repo: string;
  token: string;
  title: string;
  body: string;
  labels: string[];
}) {
  return requestGitHub({
    action: 'issue creation',
    token,
    path: `/repos/${repo}/issues`,
    method: 'POST',
    body: {
      title,
      // The field limits already fit; this holds GitHub's limit for any body.
      body: truncateText(body, GITHUB_ISSUE_BODY_MAX),
      labels,
    },
    read: (response) => response.json(),
  });
}

/**
 * The fingerprint lines an open issue for `payload` may carry: the digest this
 * code files, and the raw-JSON fingerprint of issues filed before the digest.
 */
async function fingerprintMarkers(payload: ErrorTelemetry) {
  const fingerprint = await issueFingerprint(payload);
  return {
    fingerprint,
    markers: [
      `${FINGERPRINT_LABEL}${fingerprint}`,
      `${FINGERPRINT_LABEL}${buildTelemetryFingerprint(payload)}`,
    ],
  };
}

async function findMatchingOpenAutoReportedIssue({
  repo,
  token,
  markers,
}: {
  repo: string;
  token: string;
  markers: string[];
}) {
  for (let page = 1; ; page += 1) {
    const params = new URLSearchParams({
      state: 'open',
      labels: 'auto-reported',
      per_page: String(GITHUB_ISSUES_PAGE_SIZE),
      page: String(page),
    });
    const issues = await requestGitHub({
      action: 'issue deduplication',
      token,
      path: `/repos/${repo}/issues?${params}`,
      method: 'GET',
      read: async (response) =>
        (await response.json()) as {
          number?: number;
          body?: string | null;
        }[],
    });
    const matchingIssue = issues.find((issue) =>
      markers.some((marker) => issue.body?.includes(marker)),
    );

    if (matchingIssue || issues.length < GITHUB_ISSUES_PAGE_SIZE) {
      return matchingIssue;
    }
  }
}

export async function createAutoReportedIssue({
  repo,
  token,
  payload,
}: {
  repo: string;
  token: string;
  payload: ErrorTelemetry;
}) {
  const { fingerprint, markers } = await fingerprintMarkers(payload);
  const matchingIssue = await findMatchingOpenAutoReportedIssue({
    repo,
    token,
    markers,
  });

  if (matchingIssue) {
    return { deduped: true, issueNumber: matchingIssue.number };
  }

  return createGitHubIssue({
    repo,
    token,
    title: `${AUTO_REPORTED_TITLE_PREFIX}${payload.message.slice(0, GITHUB_ISSUE_TITLE_MAX - AUTO_REPORTED_TITLE_PREFIX.length)}`,
    body: buildAutoReportedIssueBody(payload, fingerprint),
    labels: ['bug', 'auto-reported'],
  });
}

export async function createUserReportedIssue({
  repo,
  token,
  payload,
}: {
  repo: string;
  token: string;
  payload: UserIssueReport;
}) {
  return createGitHubIssue({
    repo,
    token,
    title: 'User-reported issue',
    body: buildUserReportedIssueBody(payload),
    labels: ['bug', 'user-reported'],
  });
}
