import { expect, test } from 'bun:test';
import { summaryUser } from '../test/builder-fixtures.ts';
import { builderNav, guardInitialUrl, guardStep, steps } from './steps.ts';

test('twelve ordered Steps have explicit Previous links and prerequisites', () => {
  expect(steps).toHaveLength(12);
  expect(new Set(steps.map((step) => step.id)).size).toBe(12);
  for (const [index, step] of steps.entries()) {
    expect(
      builderNav(step.id, new URL(`https://scc.example${step.path}`)).previous,
    ).toBe(index ? steps[index - 1].path : '/');
    expect(step).toHaveProperty('section');
    expect(step).toHaveProperty('prerequisites');
  }
  expect(guardStep('summary', {})).toBe('/info');
  expect(guardStep('summary', { info: summaryUser.info })).toBe('/experience');
  expect(guardStep('summary', summaryUser)).toBeUndefined();
});
test('builderNav validates same-origin root-relative Revisit paths', () => {
  for (const value of [
    '//evil',
    'https://scc.example/resume',
    '/\\evil',
    '/\n/evil',
    'resume',
  ]) {
    expect(
      builderNav(
        'summary',
        new URL(
          `https://scc.example/summary?returnUrl=${encodeURIComponent(value)}`,
        ),
      ).returnUrl,
    ).toBeUndefined();
  }
  expect(
    builderNav(
      'summary',
      new URL('https://scc.example/summary?returnUrl=%2Ffinish-up%3Fx%3D1'),
    ).returnUrl,
  ).toBe('/finish-up?x=1');
});

test('initial deep links use the same prerequisite guard and leave non-builder URLs alone', () => {
  expect(
    guardInitialUrl(new URL('https://scc.example/summary'), {}, {}, [
      'info',
      'summary',
    ]),
  ).toBe('/info');
  expect(
    guardInitialUrl(new URL('https://scc.example/summary'), summaryUser, {}, [
      'info',
      'summary',
    ]),
  ).toBeUndefined();
  expect(
    guardInitialUrl(new URL('https://scc.example/'), {}, {}, [
      'info',
      'summary',
    ]),
  ).toBeUndefined();
});
