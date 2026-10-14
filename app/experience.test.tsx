import { afterEach, expect, test } from 'bun:test';
import { renderToString } from 'remix/component/server';
import { render } from 'remix/component/test';
import { builderRequest, experience, info } from '../test/builder-fixtures.ts';
import { createSessionStorageMock } from '../test/storage.ts';
import { SUGGESTIONS_UNAVAILABLE } from './builder/suggestions.ts';
import { ExperiencePage } from './pages/experience.tsx';
import { ExperienceEntryPage } from './pages/experience-entry.tsx';
import { ExperienceSummaryPage } from './pages/experience-summary.tsx';
import { createAppRouter } from './router.tsx';
import { createUserStorage, STORAGE_KEY } from './user.ts';

function setup() {
  const mock = createSessionStorageMock();
  const storage = createUserStorage(
    () => mock,
    () => {},
  );
  storage.write('info', info);
  return { mock, storage, router: createAppRouter(storage) };
}
const job = { ...experience[0], currentlyEmployed: 'on' };
const jobForm = Object.fromEntries(
  Object.entries(job)
    .filter(([key]) => key !== 'details')
    .map(([key, value]) => [key, String(value)]),
);
test('Experience journey adds two jobs, edits first by id, deletes second, reloads Draft, and continues', async () => {
  const { mock, storage, router } = setup();
  for (const id of ['job-1', 'job-2']) {
    const response = await router.fetch(
      builderRequest('/experience', { ...jobForm, jobId: id }),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe(
      `/experience-entry?jobId=${id}`,
    );
    const reloaded = createUserStorage(
      () => mock,
      () => {},
    );
    expect(reloaded.read()).toMatchObject({
      value: { drafts: { experience: { jobId: id } } },
    });
    expect(
      (
        await createAppRouter(reloaded).fetch(
          builderRequest(`/experience-entry?jobId=${id}`),
        )
      ).status,
    ).toBe(200);
    const committed = await router.fetch(
      builderRequest(`/experience-entry?jobId=${id}`, {
        jobId: id,
        details: 'Built software',
      }),
    );
    expect(committed.headers.get('Location')).toBe('/experience-summary');
    expect(storage.read()).toMatchObject({ value: { drafts: {} } });
  }
  const edit = '/experience?jobId=job-1&returnUrl=%2Fexperience-summary';
  expect((await router.fetch(builderRequest(edit))).status).toBe(200);
  const changed = await router.fetch(
    builderRequest(edit, { ...jobForm, employer: 'Changed' }),
  );
  expect(changed.headers.get('Location')).toBe(
    '/experience-entry?jobId=job-1&returnUrl=%2Fexperience-summary',
  );
  expect(
    (
      await router.fetch(
        builderRequest(changed.headers.get('Location')!, {
          jobId: 'job-1',
          details: 'Updated',
        }),
      )
    ).headers.get('Location'),
  ).toBe('/experience-summary');
  expect(storage.read()).toMatchObject({
    value: {
      user: {
        experience: [
          { jobId: 'job-1', employer: 'Changed', details: ['Updated'] },
          { jobId: 'job-2' },
        ],
      },
    },
  });
  expect(
    (
      await router.fetch(
        builderRequest('/experience-summary', {
          intent: 'delete',
          jobId: 'job-2',
        }),
      )
    ).headers.get('Location'),
  ).toBe('/experience-summary');
  expect(storage.read()).toMatchObject({
    value: { user: { experience: [{ jobId: 'job-1' }] } },
  });
  expect(
    (await router.fetch(builderRequest('/experience-summary', {}))).headers.get(
      'Location',
    ),
  ).toBe('/education-level');
  expect(
    (
      await router.fetch(
        builderRequest('/experience-summary?returnUrl=%2Ffinish-up', {}),
      )
    ).headers.get('Location'),
  ).toBe('/finish-up');
});
test('unknown ids redirect to Hub; landing on Hub clears Draft; invalid and failed writes preserve User', async () => {
  const { mock, storage, router } = setup();
  storage.writeEntry('experience', experience[0]);
  expect(
    (await router.fetch(builderRequest('/experience-entry?jobId=job-1')))
      .status,
  ).toBe(200);
  for (const path of ['/experience', '/experience-entry'])
    expect(
      (await router.fetch(builderRequest(`${path}?jobId=missing`))).headers.get(
        'Location',
      ),
    ).toBe('/experience-summary');
  storage.seedDraft('experience', 'job-1');
  expect(
    (await router.fetch(builderRequest('/experience', { jobId: 'job-1' })))
      .status,
  ).toBe(400);
  expect(storage.read()).toMatchObject({
    value: { drafts: { experience: { jobId: 'job-1' } } },
  });
  expect(
    (await router.fetch(builderRequest('/experience-summary'))).status,
  ).toBe(200);
  expect(storage.read()).toMatchObject({ value: { drafts: {} } });
  storage.seedDraft('experience', 'job-1');
  const before = mock.getItem(STORAGE_KEY);
  mock.setItem = () => {
    throw new Error('quota');
  };
  expect(
    (
      await router.fetch(
        builderRequest('/experience-entry?jobId=job-1', {
          jobId: 'job-1',
          details: 'Changed',
        }),
      )
    ).status,
  ).toBe(500);
  expect(mock.getItem(STORAGE_KEY)).toBe(before);
});
const originalFetch = globalThis.fetch;
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  globalThis.fetch = originalFetch;
});
test('detail rows preserve identity, DOM nodes and focus while typing, adding and removing; Draft survives reload', async () => {
  const { mock, storage } = setup();
  storage.writeDraft('experience', experience[0]);
  let request: RequestInit | undefined;
  globalThis.fetch = (async (path: RequestInfo | URL, init?: RequestInit) => {
    expect(path).toBe('/api/experience');
    request = init;
    return Response.json({ expertRecommended: ['Suggested'], other: [] });
  }) as unknown as typeof fetch;
  const view = render(
    <ExperienceEntryPage
      url={new URL('https://scc.example/experience-entry?jobId=job-1')}
      values={{ jobId: 'job-1', details: ['First', 'Second'], prompt: 'job' }}
      saveDraft={(values) => {
        const result = storage.writeDraft('experience', {
          ...experience[0],
          details: values.details as string[],
        });
        return result.ok ? undefined : 'Save failed';
      }}
    />,
  );
  cleanups.push(view.cleanup);
  await view.act(async () => {
    await new Promise((done) => setTimeout(done, 0));
  });
  const [first, second] = Array.from(
    view.$$('textarea'),
  ) as HTMLTextAreaElement[];
  const ids = [first!.id, second!.id];
  await view.act(() => {
    first!.focus();
    first!.value = 'Typed';
    first!.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(view.$$('textarea')[0]).toBe(first);
  expect(document.activeElement).toBe(first);
  await view.act(() => {
    (
      Array.from(view.$$('button')).find(
        (button) => button.textContent === 'Add detail',
      ) as HTMLButtonElement
    ).click();
  });
  expect(
    Array.from(view.$$('textarea'))
      .slice(0, 2)
      .map((node) => node.id),
  ).toEqual(ids);
  await view.act(() => {
    (view.$('button') as HTMLButtonElement).click();
  });
  expect(view.$$('textarea')[0]).toBe(second);
  expect(second!.id).toBe(ids[1]!);
  const reloaded = createUserStorage(
    () => mock,
    () => {},
  );
  expect(reloaded.read()).toMatchObject({
    value: { drafts: { experience: { details: ['Second', ''] } } },
  });
  expect(JSON.parse(String(request?.body))).toEqual({ prompt: 'job' });
});
test('Experience Suggestions fail with fixed copy and do not overwrite details; Previous and Revisit carry identity', async () => {
  globalThis.fetch = (async () =>
    Response.json(
      { error: 'private' },
      { status: 403 },
    )) as unknown as typeof fetch;
  const view = render(
    <ExperienceEntryPage
      url={new URL('https://scc.example/experience-entry?jobId=job-1')}
      values={{ jobId: 'job-1', details: ['Typed'], prompt: 'job' }}
    />,
  );
  cleanups.push(view.cleanup);
  await view.act(async () => {
    await new Promise((done) => setTimeout(done, 0));
  });
  expect(view.container.textContent).toContain(SUGGESTIONS_UNAVAILABLE);
  expect((view.$('textarea') as HTMLTextAreaElement).value).toBe('Typed');
  expect(view.$('nav a')?.getAttribute('href')).toBe('/experience?jobId=job-1');
  const html = await renderToString(
    <ExperienceSummaryPage
      url={new URL('https://scc.example/experience-summary')}
      values={{}}
      entries={experience}
    />,
  );
  expect(html).toContain(
    '/experience?jobId=job-1&amp;returnUrl=%2Fexperience-summary',
  );
});

test('partially answered Experience fields survive reload through the Draft envelope', async () => {
  const { mock, storage } = setup();
  const view = render(
    <ExperiencePage
      url={new URL('https://scc.example/experience')}
      values={{ jobId: 'partial-job' }}
      saveDraft={(typed) => {
        return storage.writeDraft('experience', {
          jobId: String(typed.jobId),
          jobTitle: String(typed.jobTitle),
          currentlyEmployed: typed.currentlyEmployed === 'on',
        }).ok
          ? undefined
          : 'Save failed';
      }}
    />,
  );
  cleanups.push(view.cleanup);
  await view.act(() => {
    const title = view.$('#jobTitle') as HTMLInputElement;
    title.value = 'Half answered job';
    title.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const reloaded = createUserStorage(
    () => mock,
    () => {},
  );
  expect(reloaded.read()).toMatchObject({
    value: {
      drafts: {
        experience: { jobId: 'partial-job', jobTitle: 'Half answered job' },
      },
    },
  });
});
