import {
  buildSanitizedTelemetryFingerprint,
  type ErrorTelemetryPayload as ErrorTelemetry,
  errorTelemetrySchema,
  type SanitizedErrorTelemetry,
  type SanitizedUserIssueReport,
  sanitizeErrorTelemetry,
  sanitizeUserIssueReport,
  type UserIssueReportPayload as UserIssueReport,
  userIssueReportSchema,
} from '../../shared/errorReporting.ts';
import { NO_ASSETS } from '../../shared/reportAssets.ts';
import { stackSummary } from '../../shared/stackFrames.ts';
import { truncateText } from '../../shared/text.ts';
import { UpstreamTimeoutError, withDeadline } from '../lib/deadline.ts';
import { fencedBlock, inlineCode } from '../lib/markdown.ts';

export type { ErrorTelemetry, UserIssueReport };
export { errorTelemetrySchema, userIssueReportSchema };

const GITHUB_ISSUE_TITLE_MAX = 256;
export const GITHUB_ISSUE_BODY_MAX = 65_536;
const AUTO_REPORTED_TITLE_PREFIX = 'Auto-reported error: ';
const GITHUB_USER_AGENT = 'scc-backend-worker';
const FINGERPRINT_LABEL = '- Fingerprint: ';
const GITHUB_ISSUES_PAGE_SIZE = 100;
export const GITHUB_REQUEST_DEADLINE_MS = 10_000;

export type GitHubIssueCreationErrorKind = 'http' | 'network' | 'timeout';

export class GitHubIssueCreationError extends Error {
  kind: GitHubIssueCreationErrorKind;
  status?: number;

  constructor(
    message: string,
    options: {
      kind: GitHubIssueCreationErrorKind;
      status?: number;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = 'GitHubIssueCreationError';
    this.kind = options.kind;
    this.status = options.status;
  }
}

export async function issueFingerprint(telemetry: SanitizedErrorTelemetry) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(buildSanitizedTelemetryFingerprint(telemetry)),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export function buildAutoReportedIssueBody(
  payload: SanitizedErrorTelemetry,
  fingerprint: string,
) {
  return [
    '# Auto-reported application error',
    '',
    `${FINGERPRINT_LABEL}${fingerprint}`,
    `- Timestamp: ${payload.timestamp}`,
    `- URL: ${inlineCode(payload.url)}`,
    `- Message: ${inlineCode(payload.message)}`,
    '',
    '## Stack trace',
    fencedBlock(payload.stackTrace ?? 'No stack trace available.'),
  ].join('\n');
}

export function buildUserReportedIssueBody(payload: SanitizedUserIssueReport) {
  return [
    '# User-reported issue',
    '',
    `- Timestamp: ${payload.timestamp}`,
    `- URL: ${inlineCode(payload.url)}`,
  ].join('\n');
}

async function requestGitHub<T>({
  action,
  token,
  path,
  method,
  body,
  read,
}: {
  action: string;
  token: string;
  path: string;
  method: 'GET' | 'POST';
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
          await response.body?.cancel();
          throw new GitHubIssueCreationError(`GitHub ${action} failed.`, {
            kind: 'http',
            status: response.status,
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
      body: truncateText(body, GITHUB_ISSUE_BODY_MAX),
      labels,
    },
    read: (response) => response.json(),
  });
}

function autoReportedIssueTitle(telemetry: SanitizedErrorTelemetry) {
  const { name } = stackSummary(telemetry.stackTrace ?? '', 0);
  const { pathname } = new URL(telemetry.url);
  return truncateText(
    `${AUTO_REPORTED_TITLE_PREFIX}${name || 'Error'} at ${pathname}`,
    GITHUB_ISSUE_TITLE_MAX,
  );
}

async function findMatchingOpenAutoReportedIssue({
  repo,
  token,
  fingerprint,
}: {
  repo: string;
  token: string;
  fingerprint: string;
}) {
  const marker = `${FINGERPRINT_LABEL}${fingerprint}`;
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
    const matchingIssue = issues.find((issue) => issue.body?.includes(marker));

    if (matchingIssue || issues.length < GITHUB_ISSUES_PAGE_SIZE) {
      return matchingIssue;
    }
  }
}

export async function createAutoReportedIssue({
  repo,
  token,
  payload,
  knownAssets = NO_ASSETS,
}: {
  repo: string;
  token: string;
  payload: ErrorTelemetry;
  knownAssets?: ReadonlySet<string>;
}) {
  const telemetry = sanitizeErrorTelemetry(payload, { knownAssets });
  const fingerprint = await issueFingerprint(telemetry);
  const matchingIssue = await findMatchingOpenAutoReportedIssue({
    repo,
    token,
    fingerprint,
  });

  if (matchingIssue) {
    return { deduped: true, issueNumber: matchingIssue.number };
  }

  return createGitHubIssue({
    repo,
    token,
    title: autoReportedIssueTitle(telemetry),
    body: buildAutoReportedIssueBody(telemetry, fingerprint),
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
    body: buildUserReportedIssueBody(sanitizeUserIssueReport(payload)),
    labels: ['bug', 'user-reported'],
  });
}
