import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const hook = join(
  import.meta.dir,
  '../../.claude/hooks/block-dangerous-git.sh',
);

let root: string;
let mainRepo: string;
let featureTree: string;
let matchingRepo: string;

function git(cwd: string, ...args: string[]) {
  const run = Bun.spawnSync(['git', ...args], { cwd });
  if (run.exitCode !== 0) throw new Error(run.stderr.toString());
}

function runHook(command: string, cwd: string) {
  const run = Bun.spawnSync(['bash', hook], {
    stdin: Buffer.from(JSON.stringify({ tool_input: { command }, cwd })),
  });
  return run.exitCode;
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'block-git-'));
  mainRepo = join(root, 'repo');
  featureTree = join(root, 'feature');
  matchingRepo = join(root, 'matching');
  for (const repo of [mainRepo, matchingRepo]) {
    git(root, 'init', '-q', '-b', 'main', repo);
    git(
      repo,
      '-c',
      'user.name=t',
      '-c',
      'user.email=t@t',
      'commit',
      '-q',
      '--allow-empty',
      '-m',
      'init',
    );
  }
  git(mainRepo, 'worktree', 'add', '-q', '-b', 'feat', featureTree);
  git(matchingRepo, 'checkout', '-q', '-b', 'feat');
  git(matchingRepo, 'config', 'push.default', 'matching');
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

type Where = 'main' | 'feature' | 'matching';
const dirs = (): Record<Where, string> => ({
  main: mainRepo,
  feature: featureTree,
  matching: matchingRepo,
});

const allowed: [string, Where][] = [
  ['git push origin feat', 'main'],
  ['git push -u origin feat', 'main'],
  ['git push', 'feature'],
  ['git push origin HEAD', 'feature'],
  ['git push origin HEAD:feat', 'main'],
  ['git push -o ci.skip origin feat', 'main'],
  ['git push --repo=origin feat', 'main'],
  ['git push --follow-tags origin feat', 'main'],
  ['git -C {feature} push', 'main'],
  ['git -c core.pager=cat push origin feat', 'main'],
  ['git status && git push origin feat', 'main'],
  ['git stash push -m wip', 'main'],
  ['git status', 'main'],
];

const blocked: [string, Where][] = [
  ['git push', 'main'],
  ['git push origin HEAD', 'main'],
  ['git push origin main', 'feature'],
  ['git push origin "main"', 'feature'],
  ['git push origin feat:main', 'feature'],
  ['git push origin feat:refs/heads/master', 'feature'],
  ['git push origin @', 'main'],
  ['git push --force origin feat', 'feature'],
  ['git push -f origin feat', 'feature'],
  ['git push -uf origin feat', 'feature'],
  ['git push --force-with-lease origin feat', 'feature'],
  ['git push --force-with-lease=feat:abc origin feat', 'feature'],
  ['git push origin +feat', 'feature'],
  ['git push origin :feat', 'feature'],
  ['git push origin --delete feat', 'feature'],
  ['git push --mirror origin', 'feature'],
  ['git push --all origin', 'feature'],
  ['git push --branches origin', 'feature'],
  ['git push --tags origin', 'feature'],
  ['git push origin "refs/heads/*:refs/heads/*"', 'feature'],
  ['git push --repo origin main', 'feature'],
  ['git push --repo=origin main', 'feature'],
  ['git push -o ci.skip origin', 'main'],
  ['git push --push-option ci.skip origin', 'main'],
  ['git push', 'matching'],
  ['git -C {main} push', 'feature'],
  ['git -C {main} push origin HEAD', 'feature'],
  ['git -c k=v push --force origin feat', 'feature'],
  ['git --no-pager push -f origin feat', 'feature'],
  ['/usr/bin/git push origin main', 'feature'],
  ['(git push origin main)', 'feature'],
  ['{ git push origin main; }', 'feature'],
  ['echo $(git push origin main)', 'feature'],
  ['sh -c "git push origin main"', 'feature'],
  ['git status && git push origin feat && git push origin main', 'feature'],
  ['git status || git push origin main', 'feature'],
  ['git reset --hard', 'feature'],
  ['git clean -fd', 'feature'],
  ['git branch -D feat', 'feature'],
];

function expand(command: string) {
  return command.replace('{main}', mainRepo).replace('{feature}', featureTree);
}

describe('block-dangerous-git hook', () => {
  test.each(allowed)('allows %p from %s', (command, where) => {
    expect(runHook(expand(command), dirs()[where])).toBe(0);
  });

  test.each(blocked)('blocks %p from %s', (command, where) => {
    expect(runHook(expand(command), dirs()[where])).toBe(2);
  });
});
