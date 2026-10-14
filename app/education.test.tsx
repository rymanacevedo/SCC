import { expect, test } from 'bun:test';
import { renderToString } from 'remix/component/server';
import { render } from 'remix/component/test';
import { BaseEducationSchema } from '../shared/schemas/education.ts';
import { UserSchema } from '../shared/schemas/user.ts';
import { builderRequest, experience, info } from '../test/builder-fixtures.ts';
import { createSessionStorageMock } from '../test/storage.ts';
import {
  EDUCATION_CAP_ERROR,
  educationControllers,
} from './builder/education.tsx';
import { normalizeEducationEntry, sortEducationEntries } from './education.ts';
import {
  EducationEntryPage,
  EducationLevelPage,
  EducationPage,
} from './pages/education.tsx';
import { EducationSummaryPage } from './pages/education-summary.tsx';
import { createAppRouter } from './router.tsx';
import { builderNav, guardInitialUrl } from './steps.ts';
import { createUserStorage, STORAGE_KEY } from './user.ts';

test('education-flow regression #150 reaches the next Step with the school stored', async () => {
  const mock = createSessionStorageMock();
  const storage = createUserStorage(
    () => mock,
    () => {},
  );
  storage.write('info', info);
  storage.write('experience', experience);
  const router = createAppRouter(storage);
  const level = await router.fetch(
    builderRequest('/education-level', { educationLevel: 'High School' }),
  );
  expect(level.status).toBe(303);
  const school = await router.fetch(
    builderRequest(level.headers.get('Location')!, { schoolName: 'School' }),
  );
  expect(school.status).toBe(303);
  const entry = await router.fetch(
    builderRequest(school.headers.get('Location')!, {
      location: 'Boston',
      graduationDate: '2020',
    }),
  );
  expect(entry.headers.get('Location')).toBe('/education-summary');
  expect(
    (await router.fetch(builderRequest('/education-summary'))).status,
  ).toBe(200);
  expect(
    (await router.fetch(builderRequest('/education-summary', {}))).headers.get(
      'Location',
    ),
  ).toBe('/skills');
  expect(storage.read()).toMatchObject({
    value: {
      user: {
        education: [
          { schoolName: 'School', degree: 'Diploma', graduationDate: '2020' },
        ],
      },
      drafts: {},
    },
  });
});

function setupEducation() {
  const mock = createSessionStorageMock();
  const storage = createUserStorage(
    () => mock,
    () => {},
  );
  storage.write('info', info);
  storage.write('experience', experience);
  return { mock, storage, router: createAppRouter(storage) };
}
async function addSchool(
  router: ReturnType<typeof createAppRouter>,
  schoolName: string,
  graduationDate = '2020',
) {
  const level = await router.fetch(
    builderRequest('/education-level', { educationLevel: 'Certificate' }),
  );
  const school = await router.fetch(
    builderRequest(level.headers.get('Location')!, { schoolName }),
  );
  if (school.status !== 303) return school;
  return router.fetch(
    builderRequest(school.headers.get('Location')!, { graduationDate }),
  );
}
test('education Controller tests add three, refuse fourth, edit by id at cap, delete and Continue', async () => {
  const { storage, router } = setupEducation();
  for (const name of ['First', 'Second', 'Third'])
    expect((await addSchool(router, name)).status).toBe(303);
  const refused = await addSchool(router, 'Fourth');
  expect(refused.status).toBe(400);
  expect(storage.read()).toMatchObject({
    value: {
      user: {
        education: [
          { schoolName: 'First' },
          { schoolName: 'Second' },
          { schoolName: 'Third' },
        ],
      },
    },
  });
  const stored = storage.read();
  if (!stored.ok) throw Error('read');
  const [first, second] = stored.value.user.education!;
  const edit = `/education-level?educationId=${first!.educationId}&returnUrl=%2Feducation-summary`;
  expect((await router.fetch(builderRequest(edit))).status).toBe(200);
  const level = await router.fetch(
    builderRequest(edit, { educationLevel: 'Bachelors' }),
  );
  const school = await router.fetch(
    builderRequest(level.headers.get('Location')!, { schoolName: 'Edited' }),
  );
  const committed = await router.fetch(
    builderRequest(school.headers.get('Location')!, {
      degree: 'Biology',
      location: 'Boston',
      graduationDate: '2024',
    }),
  );
  expect(committed.headers.get('Location')).toBe('/education-summary');
  expect(storage.read()).toMatchObject({
    value: {
      user: {
        education: [
          {
            educationId: first!.educationId,
            schoolName: 'Edited',
            degree: 'Biology',
          },
          { educationId: second!.educationId },
          { schoolName: 'Third' },
        ],
      },
      drafts: {},
    },
  });
  expect(
    (
      await router.fetch(
        builderRequest('/education-summary', {
          intent: 'delete',
          educationId: second!.educationId,
        }),
      )
    ).headers.get('Location'),
  ).toBe('/education-summary');
  expect((await addSchool(router, 'Replacement')).status).toBe(303);
  expect(
    (
      await router.fetch(
        builderRequest('/education-summary?returnUrl=%2Ffinish-up', {}),
      )
    ).headers.get('Location'),
  ).toBe('/finish-up');
});
test('education Draft reload, guard redirects, Hub clearing and failed commit preserve User', async () => {
  const { mock, router } = setupEducation();
  expect(
    (
      await router.fetch(
        builderRequest('/education-level', { educationLevel: 'invalid' }),
      )
    ).status,
  ).toBe(400);
  expect(
    (await router.fetch(builderRequest('/education-entry'))).headers.get(
      'Location',
    ),
  ).toBe('/education-level');
  const level = await router.fetch(
    builderRequest('/education-level', { educationLevel: 'High School' }),
  );
  const path = level.headers.get('Location')!;
  const school = await router.fetch(
    builderRequest(path, { schoolName: 'Typed school' }),
  );
  const entryPath = school.headers.get('Location')!;
  const reloaded = createUserStorage(
    () => mock,
    () => {},
  );
  expect(
    (await createAppRouter(reloaded).fetch(builderRequest(entryPath))).status,
  ).toBe(200);
  const stored = reloaded.read();
  if (!stored.ok) throw Error('read');
  const id = stored.value.drafts.education!.educationId!;
  expect(stored.value.drafts.education?.schoolName).toBe('Typed school');
  for (const path of ['/education-level', '/education', '/education-entry']) {
    expect(
      (
        await router.fetch(builderRequest(`${path}?educationId=missing`))
      ).headers.get('Location'),
    ).toBe('/education-summary');
    expect(
      guardInitialUrl(
        new URL(`https://scc.example${path}?educationId=missing`),
        stored.value.user,
        stored.value.drafts,
        ['education-level', 'education', 'education-entry'],
      ),
    ).toBe('/education-summary');
  }
  const before = mock.getItem(STORAGE_KEY);
  for (const year of ['98', '2020junk', 'abcd', '20200'])
    expect(
      (
        await router.fetch(
          builderRequest(entryPath, {
            location: 'Boston',
            graduationDate: year,
          }),
        )
      ).status,
    ).toBe(400);
  expect(mock.getItem(STORAGE_KEY)).toBe(before);
  mock.setItem = () => {
    throw Error('quota');
  };
  expect(
    (
      await router.fetch(
        builderRequest(entryPath, {
          location: 'Boston',
          graduationDate: '2020',
        }),
      )
    ).status,
  ).toBe(500);
  expect(mock.getItem(STORAGE_KEY)).toBe(before);
  expect(
    builderNav('education-entry', new URL(`https://scc.example${entryPath}`))
      .previous,
  ).toBe(`/education?educationId=${id}`);
});
test('stored User with four schools parses, reloads and renders, while Hub clears only education Draft', async () => {
  const { storage, router } = setupEducation();
  const entries = Array.from({ length: 4 }, (_, index) => ({
    educationId: `school-${index}`,
    schoolName: `School ${index}`,
    graduationDate: String(2020 + index),
  }));
  expect(UserSchema.safeParse({ education: entries }).success).toBe(true);
  expect(storage.write('education', entries).ok).toBe(true);
  storage.writeDraft('education', {
    educationId: 'unfinished',
    schoolName: 'Draft',
  });
  storage.writeDraft('experience', { jobTitle: 'Kept' });
  expect(
    (await router.fetch(builderRequest('/education-summary'))).status,
  ).toBe(200);
  expect(storage.read()).toMatchObject({
    value: {
      user: { education: entries },
      drafts: { experience: { jobTitle: 'Kept' } },
    },
  });
  const html = await renderToString(
    <EducationSummaryPage
      url={new URL('https://scc.example/education-summary')}
      values={{}}
      entries={entries}
    />,
  );
  for (const entry of entries) expect(html).toContain(entry.schoolName);
  expect(html.indexOf('School 3')).toBeLessThan(html.indexOf('School 0'));
  expect(html).toContain(
    'educationId=school-3&amp;returnUrl=%2Feducation-summary',
  );
  const hub = new DOMParser().parseFromString(html, 'text/html');
  expect(
    Array.from(hub.querySelectorAll('article > span')).map(
      (badge) => badge.textContent,
    ),
  ).toEqual(entries.map((_, index) => String(index + 1)));
  expect(
    hub
      .querySelector('article input[name="educationId"]')
      ?.getAttribute('value'),
  ).toBe('school-3');
  expect(html).toContain('+ Add another education entry');
});
test('education helpers normalize degrees, trim certificate location, sort without mutation and keep ids', () => {
  expect(
    normalizeEducationEntry({ educationLevel: 'GED', degree: 'wrong' }),
  ).toMatchObject({ degree: 'Diploma' });
  expect(
    normalizeEducationEntry({
      educationLevel: 'Certificate',
      location: '  Boston  ',
    }),
  ).toMatchObject({ degree: 'Certificate', location: 'Boston' });
  const original = [
    { educationId: 'a', graduationDate: '2020' },
    { educationId: 'b', graduationDate: '2024' },
    { educationId: 'c', currentlyEnrolled: true },
    { educationId: 'd' },
  ];
  expect(
    sortEducationEntries(original).map((entry) => entry.educationId),
  ).toEqual(['c', 'b', 'a', 'd']);
  expect(original.map((entry) => entry.educationId)).toEqual([
    'a',
    'b',
    'c',
    'd',
  ]);
  for (const year of ['', '1900', '2099'])
    expect(
      BaseEducationSchema.safeParse({
        schoolName: 'School',
        educationLevel: 'GED',
        graduationDate: year,
      }).success,
    ).toBe(true);
});
test('education Component tests render inline year and cap errors and retain typed fields', async () => {
  const html = await renderToString(
    <EducationEntryPage
      url={new URL('https://scc.example/education-entry')}
      values={{
        educationId: 'id',
        graduationDate: '98',
        degree: 'Typed degree',
      }}
      errors={{
        graduationDate: ['Graduation Year must be a four-digit year.'],
      }}
    />,
  );
  expect(html).toContain('Graduation Year must be a four-digit year.');
  expect(html).toContain('value="98"');
  expect(html).toContain('aria-invalid="true"');
  const cap = await renderToString(
    <EducationPage
      url={new URL('https://scc.example/education')}
      values={{ schoolName: 'Fourth' }}
      errors={{ schoolName: [EDUCATION_CAP_ERROR] }}
    />,
  );
  expect(cap).toContain(EDUCATION_CAP_ERROR);
  expect(cap).toContain('value="Fourth"');
});
test('typing a half-finished school persists its Draft through the real page callback', async () => {
  const { mock, storage, router } = setupEducation();
  const level = await router.fetch(
    builderRequest('/education-level', { educationLevel: 'Bachelors' }),
  );
  const path = level.headers.get('Location')!;
  const stored = storage.read();
  if (!stored.ok) throw Error('read');
  const controller = educationControllers(storage)[1]!;
  // Get the page's persistence callback through the controller render props.
  let props: Parameters<typeof EducationPage>[0]['props'] | undefined;
  const action = controller.controller.actions.index;
  if (typeof action !== 'function') throw Error('Expected index action');
  await action({
    url: new URL(`https://scc.example${path}`),
    render: (node: { props: typeof props }) => {
      props = node.props;
      return new Response();
    },
  } as never);
  const view = render(<EducationPage {...props!} />);
  try {
    await view.act(() => {
      const field = view.$('[name="schoolName"]') as HTMLInputElement;
      field.value = 'Half finished';
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(
      createUserStorage(
        () => mock,
        () => {},
      ).read(),
    ).toMatchObject({
      value: {
        drafts: {
          education: {
            educationId: stored.value.drafts.education!.educationId,
            schoolName: 'Half finished',
          },
        },
      },
    });
  } finally {
    view.cleanup();
  }
});

test('Education level Component preloads the saved choice for Revisit', async () => {
  const html = await renderToString(
    <EducationLevelPage
      url={new URL('https://scc.example/education-level')}
      values={{ educationLevel: 'Certificate' }}
    />,
  );
  expect(html).toContain(
    '<option value="Certificate" selected>Certificate</option>',
  );
});
