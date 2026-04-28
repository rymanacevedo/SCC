import {
  type ErrorTelemetryPayload as ErrorTelemetry,
  errorTelemetrySchema,
  type UserIssueReportPayload as UserIssueReport,
  userIssueReportSchema,
} from '../../../shared/errorReporting';

export type { ErrorTelemetry, UserIssueReport };
export { errorTelemetrySchema, userIssueReportSchema };

const GITHUB_ISSUE_TITLE_MAX = 256;
const AUTO_REPORTED_TITLE_PREFIX = 'Auto-reported error: ';
const GITHUB_ERROR_BODY_SNIPPET_MAX = 300;
const GITHUB_USER_AGENT = 'scc-backend-worker';

export type GitHubIssueCreationErrorKind = 'http' | 'network';

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

export function buildAutoReportedIssueBody(payload: ErrorTelemetry) {
  return [
    '# Auto-reported application error',
    '',
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
  let response: Response;

  try {
    response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': GITHUB_USER_AGENT,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        title,
        body,
        labels,
      }),
    });
  } catch (error) {
    throw new GitHubIssueCreationError(
      'GitHub issue creation request failed.',
      {
        kind: 'network',
        cause: error,
      },
    );
  }

  if (!response.ok) {
    const details = (await response.text()).slice(
      0,
      GITHUB_ERROR_BODY_SNIPPET_MAX,
    );
    throw new GitHubIssueCreationError('GitHub issue creation failed.', {
      kind: 'http',
      status: response.status,
      details,
    });
  }

  return response.json();
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
  return createGitHubIssue({
    repo,
    token,
    title: `${AUTO_REPORTED_TITLE_PREFIX}${payload.message.slice(0, GITHUB_ISSUE_TITLE_MAX - AUTO_REPORTED_TITLE_PREFIX.length)}`,
    body: buildAutoReportedIssueBody(payload),
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
