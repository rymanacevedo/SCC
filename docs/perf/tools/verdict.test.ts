import { afterEach, expect, test } from 'bun:test';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createVerdict } from './verdict.mjs';

const tools = dirname(fileURLToPath(import.meta.url));
const baseline = resolve(tools, '../baseline/pre-remix-v3');
const script = join(tools, 'verdict.mjs');
const thresholdsPath = resolve(tools, '../thresholds.json');
const load = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const thresholds = load(thresholdsPath);
const before = load(join(tools, 'fixtures/before.json'));
const fixtureAfter = () => load(join(tools, 'fixtures/after.json'));
const passingAfter = () => {
  const after = fixtureAfter();
  after.lighthouse[0].median.fcp = 1100;
  after.lighthouse[1].median.bytesScript = 75000;
  return after;
};
// Git exports GIT_DIR and friends to hooks, and inside a worktree they point at
// the enclosing repository. Child processes that inherit them would then commit
// and tag there instead of in the temporary repository, so every git call and
// the verdict script itself run with those variables removed.
function isolatedEnv() {
  const env: Record<string, string | undefined> = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('GIT_')) delete env[key];
  }
  return env;
}
function git(args: string[], cwd?: string) {
  return execFileSync('git', args, { cwd, env: isolatedEnv() });
}
const temporary: string[] = [];
function temp() {
  const dir = mkdtempSync(join(tmpdir(), 'scc-verdict-'));
  temporary.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of temporary.splice(0))
    rmSync(dir, { recursive: true, force: true });
});
function run(
  beforePath: string,
  afterPath: string,
  out: string,
  cwd?: string,
  perfTag?: string,
) {
  const env = isolatedEnv();
  delete env.PERF_TAG;
  delete env.PERF_DIR;
  if (perfTag !== undefined) env.PERF_TAG = perfTag;
  return spawnSync(
    'node',
    [
      script,
      '--before',
      beforePath,
      '--after',
      afterPath,
      '--thresholds',
      thresholdsPath,
      '--out',
      out,
    ],
    { cwd, env, encoding: 'utf8' },
  );
}

test('CLI fixture verdict reports individual failures, narrow misses, target misses and final FAIL', () => {
  const out = join(temp(), 'verdict.md');
  const result = run(
    join(tools, 'fixtures/before.json'),
    join(tools, 'fixtures/after.json'),
    out,
  );
  expect(result.status).toBe(1);
  const verdict = readFileSync(out, 'utf8');
  expect(verdict).toContain(
    '| desktop | /experience | FCP ms | 1000 | 1101 | 101 | FAIL (narrow timing miss; re-collect once with 9 runs) |',
  );
  expect(verdict).toContain(
    '| desktop | / | App script bytes | 100000 | 75001 | -24999 | FAIL (byte-cut target miss (required reduction ≥ 25%)) |',
  );
  expect(verdict).toContain(
    '| desktop | /resume | App script bytes | 100000 | 75000 | -25000 | PASS |',
  );
  expect(verdict).toContain(
    'Third-party script bytes | 0 | 10224 | 10224 | REPORTED',
  );
  expect(verdict).toEndWith('Overall: FAIL\n');
});

test('inclusive boundaries pass; reported-only regressions never fail', () => {
  const after = passingAfter();
  after.lighthouse[0].median.tbt = 50;
  after.lighthouse[0].median.cls = 0.025;
  for (const cell of after.flows) {
    if (cell.mode === 'timespan') cell.median.inp = 100;
    else if (cell.formFactor === 'mobile') cell.median.cls = 0.1;
  }
  after.api.localStub.starttransferMs.p50 = 8;
  after.api.live.starttransferMs.p50 = 1e9;
  after.bundle.js.bytes = 1e9;
  after.workerBundle = { bytes: 1e9 };
  after.fieldData = { cls: 1 };
  for (const cell of after.lighthouse)
    for (const metric of ['ttfb', 'si', 'tti', 'bytesTotal'])
      cell.median[metric] = 1e9;
  const verdict = createVerdict(before, after, thresholds);
  expect(verdict).toContain('1000000000');
  expect(verdict).toEndWith('Overall: PASS\n');
});

test('FCP/LCP require both relative and absolute regressions', () => {
  for (const metric of ['fcp', 'lcp']) {
    const b = structuredClone(before);
    const a = passingAfter();
    b.lighthouse[0].median[metric] = 2000;
    a.lighthouse[0].median[metric] = 2150; // >100 ms, but <10%
    expect(createVerdict(b, a, thresholds)).toEndWith('Overall: PASS\n');
    b.lighthouse[0].median[metric] = 500;
    a.lighthouse[0].median[metric] = 590; // >10%, but <100 ms
    expect(createVerdict(b, a, thresholds)).toEndWith('Overall: PASS\n');
  }
});

test('each scored rule blocks independently and final narrow reruns still fail', () => {
  const changes = [
    (a: ReturnType<typeof passingAfter>) => {
      a.lighthouse[0].median.tbt = 50.001;
    },
    (a: ReturnType<typeof passingAfter>) => {
      a.lighthouse[0].median.cls = 0.025001;
    },
    (a: ReturnType<typeof passingAfter>) => {
      a.lighthouse[0].median.bytesScript = 105001;
    },
    (a: ReturnType<typeof passingAfter>) => {
      a.flows[3].median.cls = 0.100001;
    },
    (a: ReturnType<typeof passingAfter>) => {
      a.flows[4].median.cls = 0.100001;
    },
    (a: ReturnType<typeof passingAfter>) => {
      a.flows[2].median.inp = 100.001;
    },
    (a: ReturnType<typeof passingAfter>) => {
      a.api.localStub.starttransferMs.p50 = 8.001;
    },
  ];
  for (const change of changes) {
    const after = passingAfter();
    change(after);
    expect(createVerdict(before, after, thresholds)).toEndWith(
      'Overall: FAIL\n',
    );
  }
  const after = fixtureAfter();
  after.lighthouse[0].runs = 9;
  expect(createVerdict(before, after, thresholds)).toContain(
    'final timing miss; no further re-run',
  );
});

test('missing or invalid scored data cannot silently pass; duplicate cells are rejected', () => {
  for (const value of [null, undefined, -1, '1000']) {
    const after = passingAfter();
    after.lighthouse[0].median.fcp = value;
    expect(createVerdict(before, after, thresholds)).toContain(
      'FAIL (missing or invalid measurement)',
    );
  }
  const after = passingAfter();
  after.lighthouse.pop();
  expect(createVerdict(before, after, thresholds)).toEndWith('Overall: FAIL\n');
  after.lighthouse.push(after.lighthouse[0]);
  expect(() => createVerdict(before, after, thresholds)).toThrow('Duplicate');
});

test('baseline as both CLI inputs is an explicit PASS self-check, not a migration gate', () => {
  const out = join(temp(), 'verdict.md');
  expect(
    run(join(baseline, 'summary.json'), join(baseline, 'summary.json'), out)
      .status,
  ).toBe(0);
  const verdict = readFileSync(out, 'utf8');
  expect(verdict).toContain('Baseline self-check');
  expect(verdict).toEndWith('Overall: PASS\n');
  const original = load(join(baseline, 'summary.json'));
  expect(createVerdict(original, original, thresholds)).toEndWith(
    'Overall: FAIL\n',
  );
});

test('runbook refuses untagged HEAD and stale PERF_TAG, accepts a matching tag', () => {
  const dir = temp();
  git(['init', '-q', dir]);
  git(
    [
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '--allow-empty',
      '-qm',
      'test',
    ],
    dir,
  );
  const input = join(baseline, 'summary.json');
  const out = join(dir, 'verdict.md');
  const untagged = run(input, input, out, dir, 'remix-v3/gate-1');
  expect(untagged.status).toBe(2);
  expect(untagged.stderr).toContain('tagged HEAD');
  git(['tag', 'remix-v3/gate-1'], dir);
  expect(run(input, input, out, dir, 'stale').status).toBe(2);
  expect(run(input, input, out, dir, 'remix-v3/gate-1').status).toBe(0);
});

test('host-filtered baseline re-extraction reproduces every App script byte median', () => {
  const dir = temp();
  symlinkSync(join(baseline, 'lighthouse'), join(dir, 'lighthouse'));
  writeFileSync(
    join(dir, 'summary.json'),
    JSON.stringify({ bundle: { preserved: true } }),
  );
  execFileSync('bash', [
    join(tools, 'extract-summary.sh'),
    dir,
    thresholdsPath,
  ]);
  const extracted = load(join(dir, 'summary.json'));
  expect(extracted.bundle).toEqual({ preserved: true });
  const original = load(join(baseline, 'summary.json'));
  expect(
    extracted.lighthouse.map(
      (cell: (typeof before.lighthouse)[number]) => cell.median.bytesScript,
    ),
  ).toEqual(
    original.lighthouse.map(
      (cell: (typeof before.lighthouse)[number]) => cell.median.bytesScript,
    ),
  );
  expect(
    extracted.lighthouse.every(
      (cell: (typeof before.lighthouse)[number]) =>
        cell.median.bytesScriptThirdParty === 0,
    ),
  ).toBe(true);
  expect(readFileSync(join(dir, 'tier1.md'), 'utf8')).toContain(
    'Third-party script bytes',
  );
});

test('extraction excludes only the exact analytics host, retaining other script hosts', () => {
  const dir = temp();
  const reports = join(dir, 'lighthouse/mobile/home');
  mkdirSync(reports, { recursive: true });
  const lhr = load(
    join(
      baseline,
      'lighthouse/mobile/home',
      load(join(baseline, 'lighthouse/mobile/home/manifest.json'))[0]
        .jsonPath.split('/')
        .pop(),
    ),
  );
  lhr.audits['network-requests'].details.items = [
    {
      resourceType: 'Script',
      url: 'https://app.example/a.js',
      transferSize: 100,
    },
    {
      resourceType: 'Script',
      url: 'https://static.cloudflareinsights.com/beacon.min.js',
      transferSize: 50,
    },
    {
      resourceType: 'Script',
      url: 'https://static.cloudflareinsights.com.evil.example/a.js',
      transferSize: 20,
    },
    {
      resourceType: 'Font',
      url: 'https://static.cloudflareinsights.com/font',
      transferSize: 500,
    },
  ];
  writeFileSync(join(reports, 'report.json'), JSON.stringify(lhr));
  writeFileSync(
    join(reports, 'manifest.json'),
    JSON.stringify([{ jsonPath: 'report.json', isRepresentativeRun: true }]),
  );
  execFileSync('bash', [
    join(tools, 'extract-summary.sh'),
    dir,
    thresholdsPath,
  ]);
  expect(load(join(dir, 'summary.json')).lighthouse[0].median).toMatchObject({
    bytesScript: 120,
    bytesScriptThirdParty: 50,
  });
});

test('the 5% byte regression boundary is independent of the reduction target', () => {
  const config = structuredClone(thresholds);
  config.bytesScript.targetPages = ['home', 'summary', 'resume'];
  const after = passingAfter();
  after.lighthouse[0].median.bytesScript = 105000;
  expect(createVerdict(before, after, config)).toEndWith('Overall: PASS\n');
  after.lighthouse[0].median.bytesScript = 105001;
  expect(createVerdict(before, after, config)).toEndWith('Overall: FAIL\n');
});
