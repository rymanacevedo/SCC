import {
  type ErrorTelemetryPayload as ErrorTelemetry,
  errorTelemetrySchema,
  type UserIssueReportPayload as UserIssueReport,
  userIssueReportSchema,
} from '../../../shared/errorReporting';

export type { ErrorTelemetry, UserIssueReport };
export { errorTelemetrySchema, userIssueReportSchema };

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
  const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      title,
      body,
      labels,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `GitHub issue creation failed: ${response.status} ${details}`,
    );
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
    title: `Auto-reported error: ${payload.message}`,
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
