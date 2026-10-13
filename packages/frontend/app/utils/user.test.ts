import { beforeEach, describe, expect, test } from 'bun:test';

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

  ({ clearQueuedEducation, getQueuedEducation, setQueuedEducation } =
    await import('./user'));
});

describe('queued education helpers', () => {
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

describe('stored User compatibility with Zod 3', () => {
  test('reads fixed stored JSON as the object captured before the Zod 4 bump', async () => {
    // Captured by parsing this fixture with frontend Zod 3.25.76 before the bump.
    const { default: fixture } = await import('./fixtures/user-zod3.json');
    const { getUser } = await import('./user');
    window.sessionStorage.setItem('user', JSON.stringify(fixture.stored));
    const user = getUser();
    expect(user).not.toBeNull();
    expect(user).toEqual({
      ...fixture.parsed,
      experience: fixture.parsed.experience.map((entry) => ({
        ...entry,
        startDate: new Date(entry.startDate),
        endDate: undefined,
      })),
    });
    expect(user?.education?.[0]).not.toHaveProperty('degree');
    expect(user?.education?.[2]).toEqual({});
  });
});
