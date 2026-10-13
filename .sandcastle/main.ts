import * as sandcastle from '@ai-hero/sandcastle';
import { z } from 'zod';
import {
  createDockerSandbox,
  hooks,
  MAX_CONCURRENT_ISSUES,
  prepareEnvironment,
  SANDCASTLE_MODEL,
} from './config';
import { readTaggedOutput } from './output';

const planSchema = z.object({
  issues: z
    .array(
      z.object({
        id: z.string().regex(/^[1-9]\d*$/),
        title: z.string().min(1),
      }),
    )
    .max(MAX_CONCURRENT_ISSUES)
    .refine(
      (issues) =>
        new Set(issues.map((issue) => issue.id)).size === issues.length,
      'Each issue must appear only once.',
    ),
});

const shellQuote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const baseBranch = prepareEnvironment();
const batchId = Date.now().toString();
const batchBranch = `sandcastle/batch-${batchId}`;
const agent = () => sandcastle.codex(SANDCASTLE_MODEL);

// Each run submits one batch for human review before selecting more work.
const batch = await sandcastle.createSandbox({
  branch: batchBranch,
  baseBranch,
  sandbox: createDockerSandbox(),
  hooks,
});

async function verify(
  sandbox: sandcastle.Sandbox,
  branch: string,
): Promise<void> {
  const head = await sandbox.exec('git branch --show-current');
  if (head.exitCode !== 0 || head.stdout.trim() !== branch) {
    throw new Error(`Expected verification on branch ${branch}.`);
  }
  const verification = await sandbox.exec(
    "timeout 600s bash -c 'bun run typecheck && bun run test'",
  );
  if (verification.exitCode !== 0) {
    throw new Error(
      `Verification failed:\n${verification.stdout}\n${verification.stderr}`,
    );
  }
  const clean = await sandbox.exec('git status --porcelain');
  if (clean.exitCode !== 0 || clean.stdout.trim()) {
    throw new Error('Verification left uncommitted changes.');
  }
}

try {
  const plan = await batch.run({
    name: 'planner',
    maxIterations: 1,
    agent: agent(),
    promptFile: './.sandcastle/plan-prompt.md',
    promptArgs: { MAX_ISSUES: String(MAX_CONCURRENT_ISSUES) },
    completionSignal: '</plan>',
  });
  const unchanged = await batch.exec(
    `git diff --quiet ${shellQuote(baseBranch)} HEAD && test -z "$(git status --porcelain)"`,
  );
  if (unchanged.exitCode !== 0) {
    throw new Error(
      'Planner changed the batch branch; aborting before implementation.',
    );
  }

  const issues = readTaggedOutput(plan.stdout, 'plan', planSchema).issues.map(
    (issue) => ({
      ...issue,
      branch: `sandcastle/issue-${issue.id}-${batchId}`,
    }),
  );

  if (!issues.length) {
    console.log('No unblocked Sandcastle issues outside existing PRs.');
  } else {
    const settled = await Promise.allSettled(
      issues.map(async (issue) => {
        const sandbox = await sandcastle.createSandbox({
          branch: issue.branch,
          baseBranch,
          sandbox: createDockerSandbox(),
          hooks,
        });
        try {
          const implement = await sandbox.run({
            name: `implementer-${issue.id}`,
            maxIterations: 1,
            agent: agent(),
            promptFile: './.sandcastle/implement-prompt.md',
            promptArgs: {
              TASK_ID: issue.id,
              ISSUE_TITLE: issue.title,
              BRANCH: issue.branch,
            },
          });
          if (!implement.commits.length) return null;
          if (!implement.completionSignal) {
            throw new Error(
              `Issue ${issue.id} implementation did not signal completion.`,
            );
          }
          const review = await sandbox.run({
            name: `reviewer-${issue.id}`,
            maxIterations: 1,
            agent: agent(),
            promptFile: './.sandcastle/review-prompt.md',
            promptArgs: { BRANCH: issue.branch, BASE_BRANCH: baseBranch },
          });
          if (!review.completionSignal) {
            throw new Error(
              `Issue ${issue.id} review did not signal completion.`,
            );
          }
          await verify(sandbox, issue.branch);
          return issue;
        } finally {
          const closed = await sandbox.close();
          if (closed.preservedWorktreePath) {
            console.log(
              `Preserved issue worktree: ${closed.preservedWorktreePath}`,
            );
          }
        }
      }),
    );

    const completed: typeof issues = [];
    for (const [index, outcome] of settled.entries()) {
      if (outcome.status === 'rejected') {
        console.error(`Issue ${issues[index]?.id} failed:`, outcome.reason);
      } else if (outcome.value) {
        completed.push(outcome.value);
      }
    }

    if (!completed.length) {
      console.log('No verified branches available for a PR.');
    } else {
      const result = await batch.run({
        name: 'batch-merger',
        maxIterations: 1,
        agent: agent(),
        promptFile: './.sandcastle/merge-prompt.md',
        promptArgs: {
          BASE_BRANCH: baseBranch,
          BATCH_BRANCH: batchBranch,
          BRANCHES: completed.map((issue) => `- ${issue.branch}`).join('\n'),
          ISSUES: completed
            .map((issue) => `- #${issue.id}: ${issue.title}`)
            .join('\n'),
        },
        completionSignal: '</pull-request>',
      });
      const metadata = readTaggedOutput(
        result.stdout,
        'pull-request',
        z.object({ title: z.string().min(1).max(256) }),
      );
      await verify(batch, batchBranch);
      for (const issue of completed) {
        const merged = await batch.exec(
          `git merge-base --is-ancestor ${shellQuote(issue.branch)} HEAD`,
        );
        if (merged.exitCode !== 0) {
          throw new Error(
            `Reviewed branch ${issue.branch} is missing from the batch.`,
          );
        }
      }
      const bodyChecks = [
        '## Summary',
        '## Evidence',
        '## Merge Danger',
        ...completed.map((issue) => `Closes #${issue.id}`),
      ];
      const body = await batch.exec(
        bodyChecks
          .map(
            (heading) =>
              `grep -Fxq ${shellQuote(heading)} /home/agent/tmp/sandcastle-pr.md`,
          )
          .join(' && '),
      );
      if (body.exitCode !== 0)
        throw new Error('The pr skill did not produce a PR body.');
      const push = await batch.exec(
        `gh auth setup-git && timeout 120s git push --set-upstream origin ${shellQuote(batchBranch)}`,
      );
      if (push.exitCode !== 0)
        throw new Error(`Batch push failed:\n${push.stderr}`);
      const pr = await batch.exec(
        [
          'timeout 120s gh pr create',
          `--base ${shellQuote(baseBranch)}`,
          `--head ${shellQuote(batchBranch)}`,
          `--title ${shellQuote(metadata.title)}`,
          '--body-file /home/agent/tmp/sandcastle-pr.md',
        ].join(' '),
      );
      if (pr.exitCode !== 0)
        throw new Error(`PR creation failed:\n${pr.stderr}`);
      console.log(`PR submitted for human review: ${pr.stdout.trim()}`);
    }
  }
} finally {
  const closed = await batch.close();
  if (closed.preservedWorktreePath) {
    console.log(`Preserved batch worktree: ${closed.preservedWorktreePath}`);
  }
}
