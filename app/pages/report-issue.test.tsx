import { afterEach, expect, test } from 'bun:test';
import { renderToString } from 'remix/component/server';
import { render } from 'remix/component/test';
import { ERROR_MODAL_MESSAGE } from '../error-reporting.ts';
import { buttonClass } from '../ui/button.tsx';
import { ErrorPage, NotFoundPage } from './error.tsx';
import { Shell } from './shell.tsx';

const original = globalThis.fetch;
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  globalThis.fetch = original;
});

test('error and 404 pages render recovery copy and the shell report action', async () => {
  const html = await renderToString(
    <Shell>
      <ErrorPage />
    </Shell>,
  );
  expect(html).toContain(ERROR_MODAL_MESSAGE);
  expect(html).toContain('Report an issue');
  expect(html).toContain('<footer');
  const notFound = await renderToString(
    <Shell>
      <NotFoundPage />
    </Shell>,
  );
  expect(notFound).toContain('Page not found');
  expect(notFound).toContain('Return home');
});

test('report modal validates, submits only explicit description, and shows failure then success', async () => {
  const requests: { path: string; body: Record<string, unknown> }[] = [];
  let resolve!: (response: Response) => void;
  globalThis.fetch = ((path: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ path: String(path), body: JSON.parse(String(init?.body)) });
    return new Promise<Response>((done) => {
      resolve = done;
    });
  }) as unknown as typeof fetch;
  const view = render(
    <Shell>
      <p>Builder remains available</p>
    </Shell>,
  );
  cleanups.push(view.cleanup);
  const dialog = view.$('dialog') as HTMLDialogElement;
  // happy-dom has no native modal implementation; real browser coverage exercises it.
  dialog.showModal = () => dialog.setAttribute('open', '');
  dialog.close = () => dialog.removeAttribute('open');
  await view.act(() => (view.$('footer button') as HTMLButtonElement).click());
  expect(dialog.open).toBe(true);
  const form = view.$('dialog form') as HTMLFormElement;
  const textarea = view.$('textarea') as HTMLTextAreaElement;
  async function submit() {
    await view.act(async () => {
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
    });
  }
  textarea.value = '   ';
  await submit();
  expect(requests).toHaveLength(0);
  expect(view.$('[role="alert"]')?.textContent).toBe(
    'Please describe what happened.',
  );
  textarea.value = '  The page failed  ';
  await submit();
  await submit();
  expect(requests).toHaveLength(1);
  expect(view.$('button[type="submit"]')?.hasAttribute('disabled')).toBe(true);
  expect(requests[0]).toEqual({
    path: '/api/report-issue',
    body: {
      description: 'The page failed',
      url: window.location.href,
      timestamp: expect.any(String),
    },
  });
  await view.act(async () => {
    resolve(
      Response.json({ error: 'private GitHub details' }, { status: 502 }),
    );
    await new Promise((done) => setTimeout(done, 0));
  });
  expect(view.$('[role="alert"]')?.textContent).toContain('Please try again');
  expect(textarea.value).toBe('  The page failed  ');
  await submit();
  await view.act(async () => {
    resolve(Response.json({ ok: true }));
    await new Promise((done) => setTimeout(done, 0));
  });
  expect(view.$('[role="status"]')?.textContent).toContain(
    'Your issue has been reported',
  );
  expect(textarea.value).toBe('');
  await view.act(() =>
    (view.$('dialog button[type="button"]') as HTMLButtonElement).click(),
  );
  expect(dialog.open).toBe(false);
  expect(view.container.textContent).toContain('Builder remains available');
});

test('a network failure shows plain failure copy and leaves the modal usable', async () => {
  globalThis.fetch = (async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;
  const view = render(<Shell />);
  cleanups.push(view.cleanup);
  (view.$('textarea') as HTMLTextAreaElement).value = 'Cannot continue';
  await view.act(async () => {
    (view.$('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await new Promise((done) => setTimeout(done, 0));
  });
  expect(view.$('[role="alert"]')?.textContent).toContain('Please try again');
  expect(view.$('button[type="submit"]')?.hasAttribute('disabled')).toBe(false);
});

test('the Shell has no header bar and a footer with help copy and an outline report button', async () => {
  const html = await renderToString(<Shell />);
  expect(html).not.toContain('<header');
  expect(html).toContain(
    'Need help? Click the report issue button to submit a report.',
  );
  const view = render(<Shell />);
  cleanups.push(view.cleanup);
  expect(view.$('footer button')?.className).toBe(buttonClass('outline'));
});
