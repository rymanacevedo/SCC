import { afterEach, expect, test } from 'bun:test';
import { renderToString } from 'remix/component/server';
import { render } from 'remix/component/test';
import {
  builderRequest,
  info,
  summary,
  summaryUser,
} from '../test/builder-fixtures.ts';
import { createSessionStorageMock } from '../test/storage.ts';
import { completedSections } from './builder/finish-up.tsx';
import { SUGGESTIONS_UNAVAILABLE } from './builder/suggestions.ts';
import { FinishUpPage } from './pages/finish-up.tsx';
import { SkillsPage } from './pages/skills.tsx';
import { builderPageIds, createAppRouter } from './router.tsx';
import { guardInitialUrl } from './steps.ts';
import { createUserStorage, STORAGE_KEY } from './user.ts';

function setup() {
  const mock = createSessionStorageMock();
  const storage = createUserStorage(
    () => mock,
    () => {},
  );
  return { mock, storage, router: createAppRouter(storage) };
}
function skillsRequest(skills: string[]) {
  const data = new URLSearchParams();
  for (const skill of skills) data.append('other', skill);
  return new Request('https://scc.example/skills', {
    method: 'POST',
    body: data,
  });
}
test('Skills factory GET/400/303 preserves User on invalid submit and supports zero, one, and repeated skills', async () => {
  const { mock, storage, router } = setup();
  for (const section of ['info', 'experience', 'education'] as const)
    storage.write(section, summaryUser[section]!);
  expect((await router.fetch(builderRequest('/skills'))).status).toBe(200);
  const before = mock.getItem(STORAGE_KEY);
  expect(
    (await router.fetch(skillsRequest(['1', '2', '3', '4', '5', '6', '7'])))
      .status,
  ).toBe(400);
  expect(mock.getItem(STORAGE_KEY)).toBe(before);
  // A blank typed entry submits alongside the chips and is dropped.
  expect(
    (await router.fetch(skillsRequest(['1', '2', '3', '4', '5', '6', ''])))
      .status,
  ).toBe(303);
  for (const skills of [[], ['TypeScript'], ['TypeScript', 'Communication']]) {
    const result = await router.fetch(skillsRequest(skills));
    expect(result.status).toBe(303);
    expect(result.headers.get('Location')).toBe('/summary');
    expect(storage.read()).toMatchObject({
      value: { user: { skills: { expertRecommended: [], other: skills } } },
    });
  }
  mock.setItem = () => {
    throw Error('quota');
  };
  expect((await router.fetch(skillsRequest(['Typed']))).status).toBe(500);
});
test('whole journey reaches finish-up through the router without seeding any Section', async () => {
  const { storage, router } = setup();
  expect((await router.fetch(builderRequest('/'))).status).toBe(200);
  let response = await router.fetch(builderRequest('/info', info));
  expect(response.headers.get('Location')).toBe('/experience');
  response = await router.fetch(
    builderRequest('/experience', {
      jobId: 'job-1',
      jobTitle: 'Developer',
      employer: 'Company',
      city: 'Boston',
      state: 'MA',
      currentlyEmployed: 'on',
      startDate: '2020-01-01',
    }),
  );
  const entryPath = response.headers.get('Location')!;
  const id = new URL(entryPath, 'https://scc.example').searchParams.get(
    'jobId',
  )!;
  response = await router.fetch(
    builderRequest(entryPath, {
      jobId: id,
      details: 'Built reliable software',
    }),
  );
  expect(response.headers.get('Location')).toBe('/experience-summary');
  response = await router.fetch(builderRequest('/experience-summary', {}));
  expect(response.headers.get('Location')).toBe('/education-level');
  response = await router.fetch(
    builderRequest('/education-level', { educationLevel: 'Certificate' }),
  );
  response = await router.fetch(
    builderRequest(response.headers.get('Location')!, {
      schoolName: 'College',
    }),
  );
  response = await router.fetch(
    builderRequest(response.headers.get('Location')!, {
      graduationDate: '2024',
    }),
  );
  expect(response.headers.get('Location')).toBe('/education-summary');
  response = await router.fetch(builderRequest('/education-summary', {}));
  expect(response.headers.get('Location')).toBe('/skills');
  response = await router.fetch(skillsRequest(['TypeScript']));
  expect(response.headers.get('Location')).toBe('/summary');
  response = await router.fetch(builderRequest('/summary', { summary }));
  expect(response.headers.get('Location')).toBe('/finish-up');
  expect((await router.fetch(builderRequest('/finish-up'))).status).toBe(200);
  const stored = storage.read();
  if (!stored.ok) throw Error('read');
  expect(
    completedSections(stored.value.user).map((section) => section.section),
  ).toEqual(['info', 'experience', 'education', 'skills', 'summary']);
  expect(
    (await router.fetch(builderRequest('/finish-up', {}))).headers.get(
      'Location',
    ),
  ).toBe('/resume');
});
test('Start over refuses unconfirmed POST, clears User and every Draft only after confirm, and surfaces storage failures', async () => {
  const { mock, storage, router } = setup();
  storage.write('info', info);
  storage.writeDraft('experience', { jobTitle: 'Draft' });
  storage.writeDraft('education', { schoolName: 'Draft' });
  const before = mock.getItem(STORAGE_KEY);
  expect(
    (await router.fetch(builderRequest('/finish-up', { intent: 'start-over' })))
      .status,
  ).toBe(400);
  expect(mock.getItem(STORAGE_KEY)).toBe(before);
  const remove = mock.removeItem.bind(mock);
  mock.removeItem = () => {
    throw Error('storage');
  };
  expect(
    (
      await router.fetch(
        builderRequest('/finish-up', { intent: 'start-over', confirm: 'yes' }),
      )
    ).status,
  ).toBe(500);
  expect(mock.getItem(STORAGE_KEY)).toBe(before);
  mock.removeItem = remove;
  const response = await router.fetch(
    builderRequest('/finish-up', { intent: 'start-over', confirm: 'yes' }),
  );
  expect(response.status).toBe(303);
  expect(response.headers.get('Location')).toBe('/');
  expect(storage.read()).toMatchObject({ value: { user: {}, drafts: {} } });
});
const cleanups: (() => void)[] = [];
const originalFetch = globalThis.fetch;
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  globalThis.fetch = originalFetch;
});
test('Skills markup carries values and errors; finish-up lists completed Sections and discloses tab storage', async () => {
  const html = await renderToString(
    <SkillsPage
      url={new URL('https://scc.example/skills')}
      values={{ other: ['Typed skill'] }}
      errors={{ other: ['Field error'], _form: ['Form error'] }}
    />,
  );
  expect(html).toContain('value="Typed skill"');
  expect(html).toContain('aria-label="Remove Typed skill"');
  expect(html).toContain('Field error');
  expect(html).toContain('Form error');
  expect(html).not.toContain('No skills added yet.');
  const empty = await renderToString(
    <SkillsPage url={new URL('https://scc.example/skills')} values={{}} />,
  );
  expect(empty).toContain('No skills added yet.');
  expect(empty).toContain('6 of 6 remaining');
  const reviewed = { ...summaryUser, summary: { summary } };
  const finish = await renderToString(
    <FinishUpPage
      url={new URL('https://scc.example/finish-up')}
      values={{}}
      completed={completedSections(reviewed)}
      user={reviewed}
    />,
  );
  expect(finish).toContain('Start over');
  expect(finish).toMatch(
    /<button[^>]*type="submit"[^>]*>Preview Resume<\/button>/,
  );
  for (const label of ['Info', 'Experience', 'Education', 'Skills', 'Summary'])
    expect(finish).toContain(`Edit ${label}`);
  expect(finish).not.toContain('name="confirm"');
  // The review card shows each Section's answers in the old order.
  const doc = new DOMParser().parseFromString(finish, 'text/html');
  expect(
    Array.from(doc.querySelectorAll('section[aria-label] h2')).map(
      (node) => node.textContent,
    ),
  ).toEqual([
    'Personal Information',
    'Professional Summary',
    'Job Experience',
    'Education',
    'Skills',
  ]);
  expect(
    doc.querySelector('a[aria-label="Edit Summary"]')?.getAttribute('href'),
  ).toBe('/summary?returnUrl=%2Ffinish-up');
  for (const text of [
    info.email,
    summary,
    reviewed.experience![0]!.jobTitle,
    'College',
    'TypeScript',
  ])
    expect(doc.body.textContent).toContain(text);
});
test('Skills Suggestions call the API client and become selected only on click; manual add/remove and cap work', async () => {
  let calls = 0;
  globalThis.fetch = (async (path: RequestInfo | URL, init?: RequestInit) => {
    calls++;
    expect(path).toBe('/api/skills');
    expect(JSON.parse(String(init?.body))).toEqual({ prompt: 'job' });
    return Response.json({
      expertRecommended: ['TypeScript'],
      other: ['Communication'],
    });
  }) as unknown as typeof fetch;
  const view = render(
    <SkillsPage
      url={new URL('https://scc.example/skills')}
      values={{}}
      prompt="job"
    />,
  );
  cleanups.push(view.cleanup);
  await view.act(async () => {
    await new Promise((done) => setTimeout(done, 0));
  });
  expect(view.$$('input[type="hidden"]')).toHaveLength(0);
  await view.act(() => (view.$('aside button') as HTMLButtonElement).click());
  expect((view.$('[name="expertRecommended"]') as HTMLInputElement).value).toBe(
    'TypeScript',
  );
  const input = view.$('#manual-skill') as HTMLInputElement;
  for (let index = 0; index < 5; index++) {
    input.value = `Manual ${index}`;
    await view.act(() =>
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
  }
  expect(view.$$('input[type="hidden"]')).toHaveLength(6);
  expect(view.container.textContent).toContain('0 of 6 remaining');
  expect(view.$('[role="status"]')?.textContent).toContain(
    'maximum of 6 skills',
  );
  expect(view.$('#manual-skill')).toBeNull();
  expect((view.$('aside button') as HTMLButtonElement).disabled).toBe(true);
  await view.act(() =>
    (view.$('[aria-label="Remove TypeScript"]') as HTMLButtonElement).click(),
  );
  expect(view.$$('input[type="hidden"]')).toHaveLength(5);
  expect(view.$('[role="status"]')).toBeNull();
  expect(view.$('#manual-skill')).not.toBeNull();
  expect((view.$('aside button') as HTMLButtonElement).disabled).toBe(false);
  expect(calls).toBe(1);
});
test('Skills failed Suggestions show fixed unavailable copy and still allow answers', async () => {
  globalThis.fetch = (async () =>
    Response.json(
      { error: 'private provider error' },
      { status: 502 },
    )) as unknown as typeof fetch;
  const view = render(
    <SkillsPage
      url={new URL('https://scc.example/skills')}
      values={{}}
      prompt="job"
    />,
  );
  cleanups.push(view.cleanup);
  await view.act(async () => {
    await new Promise((done) => setTimeout(done, 0));
  });
  expect(view.container.textContent).toContain(SUGGESTIONS_UNAVAILABLE);
  expect(view.container.textContent).not.toContain('private provider error');
  expect(view.$('#manual-skill')).not.toBeNull();
});
test('Start over click only opens confirmation; cancel leaves no destructive form', async () => {
  const view = render(
    <FinishUpPage
      url={new URL('https://scc.example/finish-up')}
      values={{}}
      completed={[]}
      user={{}}
    />,
  );
  cleanups.push(view.cleanup);
  const button = () =>
    Array.from(view.$$('button')).find(
      (node) => node.textContent === 'Start over',
    ) as HTMLButtonElement;
  expect(view.$('[name="confirm"]')).toBeNull();
  await view.act(() => button().click());
  expect((view.$('[name="confirm"]') as HTMLButtonElement).value).toBe('yes');
  expect(view.$('[name="intent"]')?.getAttribute('value')).toBe('start-over');
  await view.act(() =>
    (
      Array.from(view.$$('button')).find(
        (node) => node.textContent === 'Cancel',
      ) as HTMLButtonElement
    ).click(),
  );
  expect(view.$('[name="confirm"]')).toBeNull();
  expect(button()).not.toBeNull();
});

test('Skills and finish-up deep links guard incomplete User; Skills Revisit returns to finish-up', async () => {
  const { storage, router } = setup();
  for (const path of ['/skills', '/finish-up']) {
    const response = await router.fetch(builderRequest(path));
    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe('/info');
    expect(
      guardInitialUrl(
        new URL(`https://scc.example${path}`),
        {},
        {},
        Object.values(builderPageIds),
      ),
    ).toBe('/info');
  }
  for (const section of ['info', 'experience', 'education'] as const)
    storage.write(section, summaryUser[section]!);
  expect(
    (await router.fetch(builderRequest('/finish-up'))).headers.get('Location'),
  ).toBe('/skills');
  const response = await router.fetch(
    builderRequest('/skills?returnUrl=%2Ffinish-up', {
      other: 'Communication',
    }),
  );
  expect(response.headers.get('Location')).toBe('/finish-up');
  expect(
    (await router.fetch(builderRequest('/finish-up'))).headers.get('Location'),
  ).toBe('/summary');
});
