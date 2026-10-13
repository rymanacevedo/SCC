import { expect, test } from 'bun:test';
import { experience, info, summaryUser } from '../test/builder-fixtures.ts';
import { createSessionStorageMock } from '../test/storage.ts';
import {
  BACKUP_KEY,
  createUserStorage,
  STORAGE_KEY,
  serializePrompt,
} from './user.ts';

function setup() {
  const mock = createSessionStorageMock();
  const events: string[] = [];
  return {
    mock,
    events,
    storage: createUserStorage(
      () => mock,
      (message) => {
        events.push(message);
      },
    ),
  };
}
test('envelope round trip creates User on first write, keeps Drafts, and drops userId', () => {
  const { mock, storage } = setup();
  storage.write('info', { ...info, userId: 'old' } as typeof info);
  storage.write('experience', experience);
  storage.writeDraft('education', { schoolName: 'typed' });
  expect(storage.read()).toMatchObject({
    ok: true,
    value: {
      version: 1,
      user: { info, experience },
      drafts: { education: { schoolName: 'typed' } },
    },
  });
  expect(mock.getItem(STORAGE_KEY)).not.toContain('userId');
  expect(JSON.parse(mock.getItem(STORAGE_KEY)!).timestamp).toMatch(/^\d{4}-/);
});
test('salvage drops only invalid Sections and Drafts and reports once across repeated reads', () => {
  const { mock, storage, events } = setup();
  mock.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 0,
      timestamp: new Date().toISOString(),
      user: { ...summaryUser, summary: { summary: 3 } },
      drafts: {
        experience: { jobTitle: 3 },
        education: { schoolName: 'kept' },
      },
    }),
  );
  expect(storage.read()).toMatchObject({
    value: { user: summaryUser, drafts: { education: { schoolName: 'kept' } } },
  });
  storage.read();
  expect(events).toHaveLength(1);
});
test('unparseable envelope is backed up, replaced by a fresh User, and reported once without content', () => {
  const { mock, storage, events } = setup();
  const raw = '{private content';
  mock.setItem(STORAGE_KEY, raw);
  expect(storage.read()).toMatchObject({ value: { user: {}, drafts: {} } });
  expect(mock.getItem(BACKUP_KEY)).toBe(raw);
  storage.read();
  expect(events).toHaveLength(1);
  expect(events[0]).not.toContain(raw);
});
test('quota or inaccessible storage returns a failed Result', () => {
  const { mock, storage } = setup();
  mock.setItem = () => {
    throw new Error('quota');
  };
  expect(storage.write('info', info)).toEqual({ ok: false, error: 'storage' });
  expect(mock.getItem(STORAGE_KEY)).toBeNull();
  expect(
    createUserStorage(() => {
      throw new Error('blocked');
    }).read(),
  ).toEqual({ ok: false, error: 'storage' });
});
test('Start over discards User and every Draft', () => {
  const { storage } = setup();
  storage.write('info', info);
  storage.writeDraft('experience', { jobTitle: 'typed' });
  storage.writeDraft('education', { schoolName: 'typed' });
  expect(storage.startOver().ok).toBe(true);
  expect(storage.read()).toMatchObject({ value: { user: {}, drafts: {} } });
});
test('prompt serializer uses stored experience and escapes answer markup', () => {
  expect(serializePrompt({})).toBeUndefined();
  expect(
    serializePrompt({
      experience: [{ ...experience[0], jobTitle: '<Developer & engineer>' }],
    }),
  ).toContain('<jobTitle>&lt;Developer &amp; engineer&gt;</jobTitle>');
  expect(serializePrompt(summaryUser)).toContain(
    '<detail1>Built reliable software</detail1>',
  );
});

test('entry commits use stable identity, keep other entries, and clear only their Draft', () => {
  const { storage } = setup();
  storage.writeEntry('experience', experience[0]);
  storage.writeEntry('experience', {
    ...experience[0],
    jobId: 'job-2',
    employer: 'Second',
  });
  storage.seedDraft('experience', 'job-1');
  storage.writeDraft('education', { schoolName: 'Unsaved school' });
  storage.writeEntry('experience', { ...experience[0], employer: 'Updated' });
  expect(storage.read()).toMatchObject({
    value: {
      user: {
        experience: [
          { jobId: 'job-1', employer: 'Updated' },
          { jobId: 'job-2', employer: 'Second' },
        ],
      },
      drafts: { education: { schoolName: 'Unsaved school' } },
    },
  });
  storage.writeEntry('education', {
    educationId: 'school-1',
    schoolName: 'First',
  });
  storage.writeEntry('education', {
    educationId: 'school-2',
    schoolName: 'Second',
  });
  storage.seedDraft('education', 'school-1');
  storage.writeEntry('education', {
    educationId: 'school-1',
    schoolName: 'Updated school',
  });
  expect(storage.read()).toMatchObject({
    value: {
      user: {
        education: [
          { educationId: 'school-1', schoolName: 'Updated school' },
          { educationId: 'school-2', schoolName: 'Second' },
        ],
      },
      drafts: {},
    },
  });
});
test('a failed entry commit preserves both the User and its Draft', () => {
  const { mock, storage } = setup();
  storage.writeEntry('experience', experience[0]);
  storage.seedDraft('experience', 'job-1');
  const before = mock.getItem(STORAGE_KEY);
  mock.setItem = () => {
    throw new Error('quota');
  };
  expect(
    storage.writeEntry('experience', { ...experience[0], employer: 'Updated' })
      .ok,
  ).toBe(false);
  expect(mock.getItem(STORAGE_KEY)).toBe(before);
});
