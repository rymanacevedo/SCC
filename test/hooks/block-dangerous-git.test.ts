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
  tags: [['push.followTags', 'true']],
  pushdefault: [['remote.pushDefault', 'https://example.com/repo.git']],
  pushurl: [['remote.origin.pushurl', 'https://example.com/repo.git']],
  pushinsteadof: [['url.https://example.com/.pushInsteadOf', '/']],
  aliased: [
    ['alias.p', 'push'],
    ['alias.ship', '!git push origin main'],
    ['alias.semi', '!git push origin main;'],
    ['alias.st', 'status'],
    ['alias.pub', 'publish'],
    ['alias.publish', 'ship'],
    ['alias.loop1', 'loop2'],
    ['alias.loop2', 'loop1'],
  ],
} satisfies Record<string, string[][]>;
type Where = keyof typeof repoConfig;

let root: string;
const dirs = {} as Record<Where, string>;

// Ignore the developer's global and system git config so results do not
// depend on the machine.
const env = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
};

function git(cwd: string, ...args: string[]) {
  const run = Bun.spawnSync(['git', ...args], { cwd, env });
  if (run.exitCode !== 0) throw new Error(run.stderr.toString());
}

function runHook(command: string, cwd: string) {
  const run = Bun.spawnSync(['bash', hook], {
    stdin: Buffer.from(JSON.stringify({ tool_input: { command }, cwd })),
    env,
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
    if (where === 'main') {
      git(repo, 'branch', 'feat');
      git(repo, 'branch', 'ryan/feat-1.2');
    }
    git(repo, 'tag', 'v1.0');
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
  ['git log -- p', 'aliased'],
  ['git commit -m "fix the git hook"', 'main'],
  ['echo git is great', 'main'],
  ['git -c user.name="Jane Doe" status', 'main'],
  [
    "git -c user.name='Jane Doe' -c user.email=j@d commit -m 'fix the git hook'",
    'main',
  ],
  ['sudo -u root git status', 'main'],
  ['timeout -s KILL 5 git log -1', 'main'],
  ['if git diff --quiet; then echo clean; fi', 'main'],
  ['find . -name "*.ts" -exec grep -l git {} +', 'main'],
  ['git log --oneline >/tmp/log.txt 2>&1', 'main'],
  ['git status | grep feat', 'main'],
  ['git -C /tmp status', 'main'],
  ['git --no-pager log -1', 'main'],
  ['git --git-dir=.git status', 'main'],
  ['git commit -m "$(cat msg.txt)"', 'main'],
  ['which git', 'main'],
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
  ['git push origin v1.0', 'feature'],
  ['git push origin refs/tags/v1.0', 'feature'],
  ['git push origin no-such-branch', 'feature'],
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
  ['git push origin feat', 'tags'],
  ['git push', 'pushdefault'],
  ['git push origin feat', 'pushurl'],
  ['git push origin feat', 'pushinsteadof'],
  // Aliases (any, since a push alias may be defined in another repo) and
  // typos git may autocorrect.
  ['git st', 'aliased'],
  ['git loop1', 'aliased'],
  ['git ship>/dev/null', 'aliased'],
  ['git semi', 'aliased'],
  ['echo x | xargs git ship', 'aliased'],
  ['cd ../aliased && git ship', 'feature'],
  ['git -C ../aliased ship', 'feature'],
  ['git pussh origin main', 'feature'],
  ['if true; then git ship; fi', 'aliased'],
  ['while true; do git ship; done', 'aliased'],
  ['! git ship', 'aliased'],
  ["sh -c 'git ship'", 'aliased'],
  ['/bin/sh -c "git ship"', 'aliased'],
  ['bash -c "cd /tmp && git ship"', 'aliased'],
  ['sudo -u root git ship', 'aliased'],
  ['timeout -s KILL 5 git ship', 'aliased'],
  ['eval git ship', 'aliased'],
  ['eval "git ship"', 'aliased'],
  ['/usr/bin/env -i git ship', 'aliased'],
  ['git -c user.name="Jane Doe" ship', 'aliased'],
  ['find . -maxdepth 0 -exec git ship \\;', 'aliased'],
  ['git p origin feat', 'aliased'],
  ['git ship', 'aliased'],
  ['git -c alias.q=push q origin feat', 'feature'],
  ['git pub', 'aliased'],
  ['git publish', 'aliased'],
  ['git -c alias.q=publish q', 'feature'],
  ['GIT_CONFIG_COUNT=1 git q', 'feature'],
  // Spellings of push that the shell assembles.
  ["git pu''sh origin main", 'feature'],
  ['git pu\\sh origin main', 'feature'],
  ['git "push" origin main', 'feature'],
  ['g\\it push origin main', 'feature'],
  ['P=pu; git ${P}sh origin main', 'feature'],
  ['git $(printf push) origin main', 'feature'],
  ['git `echo push` origin main', 'feature'],
  ['git --unknown-opt HEAD p', 'feature'],
  ["git `printf '\\160ush'` origin main", 'feature'],
  // Push plumbing.
  ['git send-pack origin HEAD:refs/heads/main', 'feature'],
  ['git http-push https://example.com/repo.git main', 'feature'],
  ['git-send-pack origin main', 'feature'],
  // Unchanged destructive patterns.
  ['git reset --hard', 'feature'],
  ["git reset --ha''rd", 'feature'],
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
