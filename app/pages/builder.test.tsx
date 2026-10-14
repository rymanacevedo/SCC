import { afterEach, expect, test } from 'bun:test';
import { renderToString } from 'remix/component/server';
import { render } from 'remix/component/test';
import { info, summary } from '../../test/builder-fixtures.ts';
import { SUGGESTION_FAILURE_MESSAGES } from '../builder/suggestions.ts';
import { buttonClass } from '../ui/button.tsx';
import { InfoPage } from './info.tsx';
import { Shell } from './shell.tsx';
import { SummaryPage } from './summary.tsx';

const url = new URL('https://scc.example/info?returnUrl=%2Ffinish-up');
const original = globalThis.fetch;
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  globalThis.fetch = original;
});
test('Info and Summary string render typed values, Field errors and Form errors', async () => {
  const html = await renderToString(
    <InfoPage
      url={url}
      values={info}
      errors={{ firstName: ['Field error'], _form: ['Form error'] }}
    />,
  );
  expect(html).toContain('value="Ada"');
  expect(html).toContain('Field error');
  expect(html).toContain('Form error');
  expect(html).toContain('data-rmx-history="push"');
  expect(html).toContain('data-rmx-reset-scroll="false"');
  expect(html).toContain('novalidate');
  expect(html).toContain('Resubmit');
  expect(html).toContain('/info?returnUrl=%2Ffinish-up');
  expect(html).toContain('start with your basic information.');
  expect(html).toContain('grid grid-cols-1 gap-6 sm:grid-cols-2');
  expect(html).toContain('<select id="state" name="state"');
  expect(html).toContain('<option value="">Select a state</option>');
  expect(html).toMatch(
    /<option value="MA" selected[^>]*>Massachusetts<\/option>/,
  );
  const summaryHtml = await renderToString(
    <SummaryPage
      url={new URL('https://scc.example/summary')}
      values={{ summary }}
      errors={{
        summary: ['Summary Field error'],
        _form: ['Summary Form error'],
      }}
    />,
  );
  expect(summaryHtml).toContain(summary);
  expect(summaryHtml).toContain('Summary Field error');
  expect(summaryHtml).toContain('Summary Form error');
  expect(summaryHtml).toContain('Writing Tips');
  expect(summaryHtml).toContain('Example Summaries');
  expect(summaryHtml.indexOf('</form>')).toBeLessThan(
    summaryHtml.indexOf('<aside'),
  );
});
test('Suggestions reserve space during loading, pick only on click, and retain typed text on updates', async () => {
  let resolve!: (value: Response) => void;
  let calls = 0;
  let signal: AbortSignal | undefined;
  const response = new Promise<Response>((done) => {
    resolve = done;
  });
  globalThis.fetch = (async (_path: RequestInfo | URL, init?: RequestInit) => {
    calls++;
    signal = init?.signal ?? undefined;
    return response;
  }) as unknown as typeof fetch;
  const view = render(
    <SummaryPage
      url={new URL('https://scc.example/summary')}
      values={{ summary: 'Saved' }}
      prompt="job"
    />,
  );
  cleanups.push(view.cleanup);
  await view.act(async () => {});
  expect(view.$('[role="status"]')?.textContent).toContain('Loading');
  expect(view.$('[role="status"] svg.animate-spin')).not.toBeNull();
  expect((view.$('aside') as HTMLElement).style.minHeight).toBe('24rem');
  const textarea = view.$('textarea') as HTMLTextAreaElement;
  textarea.value = 'Typed while loading';
  await view.act(async () => {
    resolve(
      Response.json([
        { title: 'One', text: summary },
        { title: 'Two', text: 'Second' },
      ]),
    );
    await response;
    await new Promise((done) => setTimeout(done, 0));
  });
  expect(view.$$('aside button')).toHaveLength(2);
  expect(textarea.value).toBe('Typed while loading');
  await view.act(() => (view.$('aside button') as HTMLButtonElement).click());
  expect(textarea.value).toBe(summary);
  expect(calls).toBe(1);
  view.cleanup();
  expect(signal?.aborted).toBe(true);
});
async function renderFailedSummary(fail: () => Promise<Response>) {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return calls === 1
      ? fail()
      : Response.json([{ title: 'One', text: summary }]);
  }) as unknown as typeof fetch;
  const view = render(
    <SummaryPage
      url={new URL('https://scc.example/summary')}
      values={{}}
      prompt="job"
    />,
  );
  cleanups.push(view.cleanup);
  const settle = () =>
    view.act(async () => {
      await new Promise((done) => setTimeout(done, 0));
    });
  await settle();
  const retry = () =>
    [...view.$$('aside button')].find(
      (button) => button.textContent === 'Retry',
    ) as HTMLButtonElement | undefined;
  return { view, settle, retry, calls: () => calls };
}
test('a region Suggestion failure says why and offers no Retry', async () => {
  const { view, retry } = await renderFailedSummary(async () =>
    Response.json({ error: 'sensitive' }, { status: 403 }),
  );
  expect(view.$('aside [role="status"]')?.textContent).toBe(
    SUGGESTION_FAILURE_MESSAGES.region,
  );
  expect(view.container.textContent).not.toContain('sensitive');
  expect(retry()).toBeUndefined();
  expect(view.$('textarea[name="summary"]')).not.toBeNull();
});
for (const [failure, fail] of [
  [
    'offline',
    async () => {
      throw new TypeError('Failed to fetch');
    },
  ],
  [
    'generator',
    async () => Response.json({ error: 'provider' }, { status: 502 }),
  ],
] as const) {
  test(`a ${failure} Suggestion failure says why and Retry loads Suggestions`, async () => {
    const { view, settle, retry, calls } = await renderFailedSummary(fail);
    expect(view.$('aside [role="status"]')?.textContent).toBe(
      SUGGESTION_FAILURE_MESSAGES[failure],
    );
    expect(SUGGESTION_FAILURE_MESSAGES[failure]).toContain(
      'You can still write your own answer.',
    );
    await view.act(() => retry()?.click());
    expect(view.$('[role="status"]')?.textContent).toContain('Loading');
    await settle();
    expect(calls()).toBe(2);
    expect(retry()).toBeUndefined();
    expect(view.$('aside button')?.textContent).toContain('One');
  });
}
test('pending submit disables the button without removing the form or typed answers', async () => {
  const view = render(
    <Shell>
      <InfoPage url={url} values={info} />
    </Shell>,
  );
  cleanups.push(view.cleanup);
  const input = view.$('#firstName') as HTMLInputElement;
  input.value = 'Typed';
  await view.act(() => {
    view
      .$('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  expect(view.$('button')?.hasAttribute('disabled')).toBe(true);
  expect(view.$('button')?.textContent).toBe('Saving…');
  expect(view.$('form')).not.toBeNull();
  expect(input.value).toBe('Typed');
});
test('invalid render focuses first Field error', async () => {
  const view = render(
    <InfoPage
      url={url}
      values={info}
      errors={{ firstName: ['Required'], email: ['Invalid'] }}
    />,
  );
  cleanups.push(view.cleanup);
  await view.act(
    () => new Promise<void>((done) => requestAnimationFrame(() => done())),
  );
  expect(document.activeElement?.id).toBe('firstName');
});

test('a reused Builder page focuses new Field errors after submission', async () => {
  const view = render(<InfoPage url={url} values={info} />);
  cleanups.push(view.cleanup);
  await view.act(() => {
    view.root.render(
      <InfoPage
        url={url}
        values={info}
        errors={{ email: ['Invalid email'] }}
      />,
    );
  });
  await view.act(
    () => new Promise<void>((done) => requestAnimationFrame(() => done())),
  );
  expect(document.activeElement?.id).toBe('email');
});
test('navigation aborts pending Suggestions and ignores a late response', async () => {
  let resolve!: (response: Response) => void;
  let signal: AbortSignal | undefined;
  const response = new Promise<Response>((done) => {
    resolve = done;
  });
  globalThis.fetch = (async (_path: RequestInfo | URL, init?: RequestInit) => {
    signal = init?.signal ?? undefined;
    return response;
  }) as unknown as typeof fetch;
  const view = render(
    <SummaryPage
      url={new URL('https://scc.example/summary')}
      values={{}}
      prompt="job"
    />,
  );
  await view.act(async () => {});
  view.cleanup();
  expect(signal?.aborted).toBe(true);
  resolve(Response.json([{ title: 'Late', text: summary }]));
  await response;
  await new Promise((done) => setTimeout(done, 0));
});
test('builder navigation uses secondary Previous and primary submit, one column without Suggestions', async () => {
  const view = render(
    <InfoPage url={new URL('https://scc.example/info')} values={info} />,
  );
  cleanups.push(view.cleanup);
  const previous = view.$('nav a') as HTMLAnchorElement;
  expect(previous.textContent).toBe('Previous');
  expect(previous.className).toBe(buttonClass('secondary'));
  const submit = view.$('nav button[type="submit"]') as HTMLButtonElement;
  expect(submit.className).toBe(buttonClass('primary', 'ml-auto'));
  expect(view.$('form')?.parentElement?.className ?? '').not.toContain(
    'grid-cols-2',
  );
  const withSuggestions = await renderToString(
    <SummaryPage url={new URL('https://scc.example/summary')} values={{}} />,
  );
  expect(withSuggestions).toContain('md:grid-cols-2');
});
