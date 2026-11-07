import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const hook = join(
  import.meta.dir,
  '../../.claude/hooks/block-dangerous-git.sh',
);

// Throwaway repos, each with an `origin` remote. Keys are where a case runs.
const repoConfig = {
  main: [],
  feature: [],
  detached: [],
  matching: [['push.default', 'matching']],
  upstream: [['push.default', 'upstream']],
  mapped: [['remote.origin.push', 'HEAD:main']],
  mirror: [['remote.origin.mirror', 'true']],
  submodules: [['push.recurseSubmodules', 'on-demand']],
  recurse: [['submodule.recurse', 'true']],
  aliased: [
    ['alias.p', 'push'],
    ['alias.ship', '!git push origin main'],
    ['alias.st', 'status'],
  ],
} satisfies Record<string, string[][]>;
type Where = keyof typeof repoConfig;

let root: string;
const dirs = {} as Record<Where, string>;

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
  for (const [where, config] of Object.entries(repoConfig)) {
    const repo = join(root, where);
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
    git(repo, 'remote', 'add', 'origin', join(root, 'remote.git'));
    if (where === 'detached') git(repo, 'checkout', '-q', '--detach');
    else if (where !== 'main') git(repo, 'checkout', '-q', '-b', 'feat');
    for (const [key, value] of config) git(repo, 'config', key, value);
    dirs[where as Where] = repo;
  }
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

const allowed: [string, Where][] = [
  ['git push origin feat', 'main'],
  ['git push -u origin feat', 'main'],
  ['git push --set-upstream origin feat', 'main'],
  ['git push -v -n origin feat', 'main'],
  ['git push origin ryan/feat-1.2', 'main'],
  ['git push', 'feature'],
  ['git push origin', 'feature'],
  ['git push origin HEAD', 'feature'],
  ['  git push origin feat  ', 'main'],
  // Commands that do not push.
  ['git status', 'main'],
  ['git status && git log --oneline -3', 'main'],
  ['git commit -m "allow pushes"', 'main'],
  ['git st', 'aliased'],
];

const blocked: [string, Where][] = [
  // Protected or unknown destinations.
  ['git push', 'main'],
  ['git push origin', 'main'],
  ['git push origin HEAD', 'main'],
  ['git push origin main', 'feature'],
  ['git push origin master', 'feature'],
  ['git push origin heads/main', 'feature'],
  ['git push origin refs/heads/main', 'feature'],
  ['git push', 'detached'],
  ['git push upstream feat', 'feature'],
  ['git push https://example.com/repo.git feat', 'feature'],
  ['git push origin feat other', 'feature'],
  // Refspec syntax is outside the grammar.
  ['git push origin feat:main', 'feature'],
  ['git push origin +feat', 'feature'],
  ['git push origin :feat', 'feature'],
  ['git push origin "refs/heads/*:refs/heads/*"', 'feature'],
  ['git push origin @', 'feature'],
  // Options outside the allowlist, including abbreviations.
  ['git push --force origin feat', 'feature'],
  ['git push -f origin feat', 'feature'],
  ['git push -uf origin feat', 'feature'],
  ['git push --force-with-lease origin feat', 'feature'],
  ['git push --force-with-l origin feat', 'feature'],
  ['git push --delete origin feat', 'feature'],
  ['git push --del origin feat', 'feature'],
  ['git push -d origin feat', 'feature'],
  ['git push --mirror origin', 'feature'],
  ['git push --all origin', 'feature'],
  ['git push --branches origin', 'feature'],
  ['git push --tags origin', 'feature'],
  ['git push --prune origin feat', 'feature'],
  ['git push --no-verify origin feat', 'feature'],
  ['git push --recurse-submodules=on-demand origin feat', 'feature'],
  ['git push -o ci.skip origin feat', 'feature'],
  ['git push --repo=origin feat', 'feature'],
  // Anything but a lone `git push`: global options, prefixes, wrappers.
  ['git -C /tmp push origin feat', 'feature'],
  ['git -c push.default=current push', 'feature'],
  ["git -c user.name='Jane Doe' push --force origin main", 'feature'],
  ['git --no-pager push origin feat', 'feature'],
  ['git --attr-source HEAD push origin main', 'feature'],
  ['/usr/bin/git push origin feat', 'feature'],
  ['env git push origin feat', 'feature'],
  ['GIT_DIR=/tmp git push origin feat', 'feature'],
  ['HOME=/tmp git push origin feat', 'feature'],
  ['sh -c "git push origin feat"', 'feature'],
  ['(git push origin feat)', 'feature'],
  ['echo $(git push origin feat)', 'feature'],
  ['cd /tmp && git push origin feat', 'feature'],
  ['(cd /tmp && git status); git push', 'feature'],
  ['git switch main && git push origin HEAD', 'feature'],
  ['git config remote.origin.push HEAD:main && git push origin', 'feature'],
  ['git status && git push origin feat', 'feature'],
  ['git push origin feat; git push origin main', 'feature'],
  ['git push origin feat\ngit push origin main', 'feature'],
  ['git push origin feat | cat', 'feature'],
  ['git stash push -m wip', 'feature'],
  // Config that redirects where the push lands.
  ['git push', 'matching'],
  ['git push origin feat', 'matching'],
  ['git push', 'upstream'],
  ['git push origin feat', 'mapped'],
  ['git push origin', 'mirror'],
  ['git push origin feat', 'submodules'],
  ['git push origin feat', 'recurse'],
  // Aliases that expand to push.
  ['git p origin feat', 'aliased'],
  ['git ship', 'aliased'],
  ['git -c alias.q=push q origin feat', 'feature'],
  // Unchanged destructive patterns.
  ['git reset --hard', 'feature'],
  ['git clean -fd', 'feature'],
  ['git branch -D feat', 'feature'],
  ['git checkout .', 'feature'],
];

describe('block-dangerous-git hook', () => {
  test.each(allowed)('allows %p from %s', (command, where) => {
    expect(runHook(command, dirs[where])).toBe(0);
  });

  test.each(blocked)('blocks %p from %s', (command, where) => {
    expect(runHook(command, dirs[where])).toBe(2);
  });
});
