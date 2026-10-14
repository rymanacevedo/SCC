import { expect, test } from 'bun:test';
import { renderToString } from 'remix/component/server';
import {
  builderRequest,
  summary,
  summaryUser,
} from '../../test/builder-fixtures.ts';
import { createSessionStorageMock } from '../../test/storage.ts';
import { builderPageIds, createAppRouter } from '../router.tsx';
import { guardInitialUrl } from '../steps.ts';
import { createUserStorage } from '../user.ts';
import { renderDocx } from './docx.ts';
import { createOutline } from './outline.ts';
import { renderPdf } from './pdf.ts';
import { Preview } from './preview.tsx';

const user = { ...summaryUser, summary: { summary } };
const outline = createOutline(user);
test('full User produces the ordered semantic Outline without styling', () => {
  expect(outline).toEqual([
    { section: 'info', kind: 'person-name', text: 'Ada Lovelace' },
    {
      section: 'info',
      kind: 'contact-line',
      text: 'ada@example.com | 1234567890',
    },
    { section: 'info', kind: 'spacer', text: '' },
    { section: 'summary', kind: 'section-title', text: 'SUMMARY' },
    { section: 'summary', kind: 'paragraph', text: summary },
    { section: 'summary', kind: 'spacer', text: '' },
    { section: 'skills', kind: 'section-title', text: 'SKILLS' },
    { section: 'skills', kind: 'paragraph', text: 'TypeScript' },
    { section: 'skills', kind: 'spacer', text: '' },
    { section: 'experience', kind: 'section-title', text: 'EXPERIENCE' },
    {
      section: 'experience',
      kind: 'job-heading',
      text: 'Developer | Company | Boston, MA',
    },
    {
      section: 'experience',
      kind: 'date-line',
      text: 'January 2020 - Present',
    },
    { section: 'experience', kind: 'bullet', text: 'Built reliable software' },
    { section: 'experience', kind: 'spacer', text: '' },
    { section: 'education', kind: 'section-title', text: 'EDUCATION' },
    { section: 'education', kind: 'paragraph', text: 'College' },
    { section: 'education', kind: 'date-line', text: 'Graduation: N/A' },
    { section: 'education', kind: 'spacer', text: '' },
  ]);
});
test('partial User includes only present content; education sorts without mutating User', () => {
  expect(createOutline({ summary: { summary } })).toEqual(
    outline.filter((block) => block.section === 'summary'),
  );
  expect(createOutline({ experience: [], education: [] })).toEqual([]);
  const education = [
    { educationId: 'old', schoolName: 'Old', graduationDate: '2000' },
    { educationId: 'new', schoolName: 'New', graduationDate: '2020' },
    { educationId: 'current', schoolName: 'Current', currentlyEnrolled: true },
    { educationId: 'certificate', educationLevel: 'Certificate' as const },
  ];
  expect(
    createOutline({ education })
      .filter((block) => block.kind === 'paragraph')
      .map((block) => block.text),
  ).toEqual(['Current', 'New', 'Old', 'Certificate']);
  expect(education[0]!.schoolName).toBe('Old');
});
test('Preview contains every Block in order and one ordinary Edit link per Section', async () => {
  const html = await renderToString(<Preview outline={outline} />);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let position = -1;
  for (const block of outline) {
    if (!block.text) continue;
    const next = doc.body.textContent!.indexOf(block.text, position + 1);
    expect(next).toBeGreaterThan(position);
    position = next;
  }
  expect(
    Array.from(doc.querySelectorAll('a')).map((link) =>
      link.getAttribute('href'),
    ),
  ).toEqual([
    '/info',
    '/summary',
    '/skills',
    '/experience-summary',
    '/education-summary',
  ]);
  expect(doc.querySelector('h1')!.textContent).toBe('Ada Lovelace');
  expect(doc.querySelectorAll('h2').length).toBe(4);
  expect(doc.querySelector('[contenteditable]')).toBeNull();
  const partial = await renderToString(
    <Preview
      outline={createOutline({
        summary: { summary: '<script>alert(1)</script>' },
      })}
    />,
  );
  expect(partial).toContain('&lt;script&gt;');
  expect(partial).not.toContain('<script>');
  expect(partial.match(/href=/g)?.length).toBe(1);
});
test('PDF and DOCX render the same Outline into non-empty documents, including long content', async () => {
  expect(renderPdf(outline).size).toBeGreaterThan(0);
  expect((await renderDocx(outline)).size).toBeGreaterThan(0);
  const long = createOutline({
    summary: { summary: 'Long paragraph '.repeat(2000) },
  });
  expect(renderPdf(long).size).toBeGreaterThan(renderPdf(outline).size);
});
test('Preview Controller accepts partial User and redirects absent User home on GET and initial reload', async () => {
  const storage = createUserStorage(
    () => createSessionStorageMock(),
    () => {},
  );
  const empty = createAppRouter(storage);
  const response = await empty.fetch(builderRequest('/resume'));
  expect(response.status).toBe(303);
  expect(response.headers.get('Location')).toBe('/');
  const mock = createSessionStorageMock();
  const saved = createUserStorage(
    () => mock,
    () => {},
  );
  saved.write('summary', { summary });
  const router = createAppRouter(saved);
  expect((await router.fetch(builderRequest('/resume'))).status).toBe(200);
  expect(
    guardInitialUrl(
      new URL('https://scc.example/resume'),
      { summary: { summary } },
      {},
      Object.values(builderPageIds),
    ),
  ).toBeUndefined();
  expect(
    guardInitialUrl(
      new URL('https://scc.example/resume'),
      {},
      {},
      Object.values(builderPageIds),
    ),
  ).toBe('/');
});
test('Preview Start over requires confirmation and clears User and Drafts; failure preserves them', async () => {
  const mock = createSessionStorageMock();
  const storage = createUserStorage(
    () => mock,
    () => {},
  );
  const router = createAppRouter(storage);
  storage.write('summary', { summary });
  storage.writeDraft('experience', { jobTitle: 'Draft' });
  expect(
    (await router.fetch(builderRequest('/resume', { intent: 'start-over' })))
      .status,
  ).toBe(400);
  expect(storage.read()).toMatchObject({
    value: {
      user: { summary: { summary } },
      drafts: { experience: { jobTitle: 'Draft' } },
    },
  });
  const remove = mock.removeItem;
  mock.removeItem = () => {
    throw new Error('storage');
  };
  expect(
    (
      await router.fetch(
        builderRequest('/resume', { intent: 'start-over', confirm: 'yes' }),
      )
    ).status,
  ).toBe(500);
  mock.removeItem = remove;
  const response = await router.fetch(
    builderRequest('/resume', { intent: 'start-over', confirm: 'yes' }),
  );
  expect(response.status).toBe(303);
  expect(response.headers.get('Location')).toBe('/');
  expect(storage.read()).toMatchObject({ value: { user: {}, drafts: {} } });
});
