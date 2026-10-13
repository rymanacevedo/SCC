import { afterEach, expect, test } from 'bun:test';
import { renderToString } from 'remix/component/server';
import { render } from 'remix/component/test';
import { info, summary } from '../../test/builder-fixtures.ts';
import { SUGGESTIONS_UNAVAILABLE } from '../builder/suggestions.ts';
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
test('every failed Suggestion Result renders fixed unavailable copy', async () => {
  globalThis.fetch = (async () =>
    Response.json(
      { error: 'sensitive' },
      { status: 403 },
    )) as unknown as typeof fetch;
  const view = render(
    <SummaryPage
      url={new URL('https://scc.example/summary')}
      values={{}}
      prompt="job"
    />,
  );
  cleanups.push(view.cleanup);
  await view.act(async () => {
    await Promise.resolve();
  });
  expect(view.container.textContent).toContain(SUGGESTIONS_UNAVAILABLE);
  expect(view.container.textContent).not.toContain('sensitive');
});
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
