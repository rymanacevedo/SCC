import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const labels = {
  fcp: 'FCP ms',
  lcp: 'LCP ms',
  tbt: 'TBT ms',
  cls: 'CLS',
  inp: 'Editor INP ms',
  bytesScript: 'App script bytes',
  bytesScriptThirdParty: 'Third-party script bytes',
  ttfb: 'TTFB ms',
  si: 'SI ms',
  tti: 'TTI ms',
  perf: 'Lighthouse score',
  bytesTotal: 'Total bytes',
  bytesDocument: 'Document bytes',
  apiStubP50: 'Stubbed API p50 ms',
};
const finite = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
const display = (value) => (value == null ? 'unavailable' : String(value));
const escape = (value) =>
  String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');

function indexCells(cells, key, name) {
  if (!Array.isArray(cells) || cells.length === 0)
    throw new Error(`Missing ${name} cells`);
  const result = new Map();
  for (const cell of cells) {
    const id = key(cell);
    if (result.has(id)) throw new Error(`Duplicate ${name} cell: ${id}`);
    result.set(id, cell);
  }
  return result;
}

function checkThresholds(thresholds) {
  for (const [key, fields] of Object.entries({
    fcp: ['relative', 'absoluteMs'],
    lcp: ['relative', 'absoluteMs'],
    tbt: ['absoluteMs'],
    cls: ['absolute', 'seededMobileMax'],
    bytesScript: ['relative', 'reductionTarget'],
    inp: ['maxMs'],
    apiStubP50: ['absoluteMs'],
    narrowMiss: ['toleranceMultiplier', 'rerunCount'],
  }))
    for (const field of fields) {
      if (!finite(thresholds[key]?.[field]))
        throw new Error(`Invalid threshold: ${key}.${field}`);
    }
  if (
    !Array.isArray(thresholds.bytesScript.targetPages) ||
    !Array.isArray(thresholds.excludeScriptHosts) ||
    !Array.isArray(thresholds.reportedOnly)
  )
    throw new Error('Invalid threshold lists');
}

function evaluateMeasurement(
  metric,
  beforeValue,
  afterValue,
  thresholds,
  { selfCheck = false, seeded = false, target = false, runs = 0 } = {},
) {
  let fail = false;
  let note = '';
  let tolerance;
  const delta =
    finite(beforeValue) && finite(afterValue) ? afterValue - beforeValue : null;
  const scored = !thresholds.reportedOnly.includes(metric);
  if (scored && (!finite(beforeValue) || !finite(afterValue))) {
    fail = true;
    note = 'missing or invalid measurement';
  } else if (scored) {
    const rule = thresholds[metric];
    switch (metric) {
      case 'fcp':
      case 'lcp':
        tolerance = Math.max(beforeValue * rule.relative, rule.absoluteMs);
        fail = delta > tolerance;
        break;
      case 'tbt':
      case 'apiStubP50':
        tolerance = rule.absoluteMs;
        fail = delta > tolerance;
        break;
      case 'cls':
        fail =
          seeded && !selfCheck
            ? afterValue > rule.seededMobileMax
            : delta > rule.absolute;
        break;
      case 'bytesScript':
        fail = afterValue > beforeValue * (1 + rule.relative);
        if (
          !selfCheck &&
          target &&
          afterValue > beforeValue * (1 - rule.reductionTarget)
        ) {
          fail = true;
          note = `byte-cut target miss (required reduction ≥ ${rule.reductionTarget * 100}%)`;
        }
        break;
      case 'inp':
        tolerance = rule.maxMs;
        fail = afterValue > tolerance;
        break;
      default:
        throw new Error(`Unknown scored metric: ${metric}`);
    }
    if (
      fail &&
      ['fcp', 'lcp', 'tbt', 'inp'].includes(metric) &&
      (metric === 'inp' ? afterValue : delta) <
        tolerance * thresholds.narrowMiss.toleranceMultiplier
    ) {
      note =
        runs >= thresholds.narrowMiss.rerunCount
          ? 'final timing miss; no further re-run'
          : `narrow timing miss; re-collect once with ${thresholds.narrowMiss.rerunCount} runs`;
    }
  }
  let result = 'REPORTED';
  if (scored) {
    result = fail ? 'FAIL' : 'PASS';
    if (note) result += ` (${note})`;
  }
  return { fail, delta, result };
}

export function createVerdict(
  before,
  after,
  thresholds,
  { selfCheck = false } = {},
) {
  checkThresholds(thresholds);
  const lines = [
    '# Verdict',
    '',
    `App script bytes exclude ${thresholds.excludeScriptHosts.map((host) => `\`${host}\``).join(', ')} on both sides; the excluded bytes are the Third-party script bytes column.`,
    '',
    'The committed baseline host-filtered re-extraction is covered by a regression test reproducing every bytesScript median byte for byte.',
    '',
    selfCheck
      ? 'Baseline self-check: improvement gates (byte reduction and seeded mobile CLS ceiling) are not a cutover verdict.'
      : 'Every scored cell must pass. Narrow timing misses remain FAIL; re-collect once with 9 runs, then use the final medians.',
    '',
    '| form factor | page / flow | metric | before | after | delta | result |',
    '|---|---|---|---|---|---|---|',
  ];
  let failed = false;
  function row(
    ff,
    page,
    metric,
    beforeValue,
    afterValue,
    { seeded = false, target = false, runs = 0 } = {},
  ) {
    const { fail, delta, result } = evaluateMeasurement(
      metric,
      beforeValue,
      afterValue,
      thresholds,
      {
        selfCheck,
        seeded,
        target,
        runs,
      },
    );
    failed ||= fail;
    lines.push(
      `| ${[ff, page, labels[metric] ?? metric, display(beforeValue), display(afterValue), display(delta), result].map(escape).join(' | ')} |`,
    );
  }
  function compareCells(kind, key, describe, metrics) {
    const beforeCells = indexCells(before[kind], key, `before ${kind}`);
    const afterCells = indexCells(after[kind], key, `after ${kind}`);
    for (const id of new Set([...beforeCells.keys(), ...afterCells.keys()])) {
      const beforeCell = beforeCells.get(id);
      const afterCell = afterCells.get(id);
      const cell = beforeCell ?? afterCell;
      const context = describe(cell);
      for (const metric of metrics(cell)) {
        // Historical baseline had no beacon and no excluded-byte column.
        function value(cell) {
          if (metric === 'bytesScriptThirdParty' && cell) {
            return cell.median[metric] ?? 0;
          }
          return cell?.median?.[metric];
        }
        row(
          cell.formFactor,
          context.page,
          metric,
          value(beforeCell),
          value(afterCell),
          {
            ...context,
            runs: afterCell?.runs,
          },
        );
      }
    }
    return beforeCells;
  }
  const navigations = compareCells(
    'lighthouse',
    (cell) => `${cell.formFactor}/${cell.page}`,
    (cell) => ({
      page: cell.page === 'home' ? '/' : `/${cell.page}`,
      target: thresholds.bytesScript.targetPages.includes(cell.page),
    }),
    () => [
      'fcp',
      'lcp',
      'tbt',
      'cls',
      'bytesScript',
      ...thresholds.reportedOnly.filter((key) => key in labels),
    ],
  );
  for (const ff of ['mobile', 'desktop'])
    for (const page of thresholds.bytesScript.targetPages) {
      if (!navigations.has(`${ff}/${page}`))
        throw new Error(`Missing baseline navigation: ${ff}/${page}`);
    }
  const flows = compareCells(
    'flows',
    (cell) => `${cell.formFactor}/${cell.ai}/${cell.step}`,
    (cell) => ({
      page: cell.name,
      seeded:
        cell.formFactor === 'mobile' &&
        cell.mode === 'navigation' &&
        /^\/(summary|resume) seeded/.test(cell.name),
    }),
    (cell) =>
      cell.mode === 'timespan'
        ? ['inp', 'tbt', 'cls', 'perf']
        : ['fcp', 'lcp', 'tbt', 'cls', 'perf', 'si'],
  );
  for (const ff of ['mobile', 'desktop'])
    for (const step of [0, 1, 2]) {
      if (!flows.has(`${ff}/mock/${step}`))
        throw new Error(`Missing baseline flow: ${ff}/mock/${step}`);
    }
  row(
    'API',
    'POST /api/summaries',
    'apiStubP50',
    before.api?.localStub?.starttransferMs?.p50,
    after.api?.localStub?.starttransferMs?.p50,
  );
  row(
    'API',
    'POST /api/summaries',
    'api.live',
    before.api?.live?.starttransferMs?.p50,
    after.api?.live?.starttransferMs?.p50,
  );
  lines.push('', '## Reported-only appendix', '');
  for (const key of ['bundle', 'workerBundle', 'fieldData']) {
    lines.push(
      `### ${key}`,
      '',
      'Before:',
      '```json',
      JSON.stringify(before[key] ?? 'unavailable', null, 2),
      '```',
      'After:',
      '```json',
      JSON.stringify(after[key] ?? 'unavailable', null, 2),
      '```',
      '',
    );
  }
  lines.push(`Overall: ${failed ? 'FAIL' : 'PASS'}`);
  return `${lines.join('\n')}\n`;
}

export function requireRunbookTag(env = process.env) {
  if (!('PERF_TAG' in env) && !('PERF_DIR' in env)) return;
  const tags = execFileSync('git', ['tag', '--points-at', 'HEAD'], {
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter(Boolean);
  if (!tags.length) throw new Error('Perf runbook requires a tagged HEAD');
  if (env.PERF_TAG && !tags.includes(env.PERF_TAG))
    throw new Error('PERF_TAG does not tag HEAD');
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const { values } = parseArgs({
      options: Object.fromEntries(
        ['before', 'after', 'thresholds', 'out'].map((key) => [
          key,
          { type: 'string' },
        ]),
      ),
    });
    for (const key of ['before', 'after', 'thresholds', 'out'])
      if (!values[key]) throw new Error(`Required: --${key}`);
    requireRunbookTag();
    const load = (path) => JSON.parse(readFileSync(path, 'utf8'));
    const verdict = createVerdict(
      load(values.before),
      load(values.after),
      load(values.thresholds),
      {
        selfCheck: resolve(values.before) === resolve(values.after),
      },
    );
    writeFileSync(values.out, verdict);
    process.exitCode = verdict.endsWith('Overall: FAIL\n') ? 1 : 0;
  } catch (error) {
    console.error(`Verdict: ${error.message}`);
    process.exitCode = 2;
  }
}
