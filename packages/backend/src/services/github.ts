import {
  buildTelemetryFingerprint,
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
const FINGERPRINT_LABEL = '- Fingerprint: ';
const GITHUB_ISSUES_PAGE_SIZE = 100;

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
    `${FINGERPRINT_LABEL}${buildTelemetryFingerprint(payload)}`,
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

async function findMatchingOpenAutoReportedIssue({
  repo,
  token,
  fingerprint,
}: {
  repo: string;
  token: string;
  fingerprint: string;
}) {
  for (let page = 1; ; page += 1) {
    let response: Response;

    try {
      const params = new URLSearchParams({
        state: 'open',
        labels: 'auto-reported',
        per_page: String(GITHUB_ISSUES_PAGE_SIZE),
        page: String(page),
      });
      response = await fetch(
        `https://api.github.com/repos/${repo}/issues?${params}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'User-Agent': GITHUB_USER_AGENT,
            'X-GitHub-Api-Version': '2022-11-28',
          },
        },
      );
    } catch (error) {
      throw new GitHubIssueCreationError(
        'GitHub issue deduplication request failed.',
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
      throw new GitHubIssueCreationError('GitHub issue deduplication failed.', {
        kind: 'http',
        status: response.status,
        details,
      });
    }

    const issues = (await response.json()) as {
      number?: number;
      body?: string | null;
    }[];
    const matchingIssue = issues.find((issue) =>
      issue.body?.includes(`${FINGERPRINT_LABEL}${fingerprint}`),
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
  const fingerprint = buildTelemetryFingerprint(payload);
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
