import { beforeEach, describe, expect, mock, test } from 'bun:test';

let clearQueuedEducation: typeof import('./user').clearQueuedEducation;
let getQueuedEducation: typeof import('./user').getQueuedEducation;
let setQueuedEducation: typeof import('./user').setQueuedEducation;

function createSessionStorageMock() {
  const store = new Map<string, string>();

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

describe('queued education helpers', () => {
  beforeEach(async () => {
    const sessionStorage = createSessionStorageMock();
    Object.defineProperty(globalThis, 'window', {
      value: { sessionStorage },
      configurable: true,
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: sessionStorage,
      configurable: true,
    });

    mock.module('../routes/builder/info', () => ({
      PersonalInfoSchema: {
        optional: () => undefined,
      },
    }));
    mock.module('../routes/builder/skills', () => ({
      SkillsSchema: {
        optional: () => undefined,
      },
    }));
    mock.module('../routes/builder/summary', () => ({
      SummarySchema: {
        optional: () => undefined,
      },
    }));

    ({ clearQueuedEducation, getQueuedEducation, setQueuedEducation } =
      await import('./user'));
  });

  test('stores and retrieves normalized queued education entries', () => {
    setQueuedEducation({
      schoolName: 'Coursera',
      educationLevel: 'Certificate',
      graduationDate: '2024',
      currentlyEnrolled: false,
    });

    expect(getQueuedEducation()).toEqual({
      schoolName: 'Coursera',
      educationLevel: 'Certificate',
      degree: 'Certificate',
      location: '',
      graduationDate: '2024',
      currentlyEnrolled: false,
    });
  });

  test('clears queued education from session storage', () => {
    setQueuedEducation({
      schoolName: 'Coursera',
      educationLevel: 'Certificate',
      graduationDate: '2024',
      currentlyEnrolled: false,
    });

    clearQueuedEducation();

    expect(getQueuedEducation()).toBeNull();
  });
});
