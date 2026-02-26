import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import {
  type Education,
  clearQueuedEducation,
  getQueuedEducation,
  setQueuedEducation,
} from './user';

// Bun's test runner doesn't provide window/sessionStorage by default.
// Create a minimal mock so the queue helpers (which use window.sessionStorage) work.
beforeAll(() => {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  } as Storage;

  // @ts-expect-error -- polyfilling globals for test
  globalThis.window = { sessionStorage: mockStorage };
  // @ts-expect-error -- polyfilling globals for test
  globalThis.sessionStorage = mockStorage;
});

const validEducation: Education = {
  degree: 'Bachelor of Science',
  location: 'Denver, CO',
  graduationDate: '2020',
  currentlyEnrolled: false,
};

afterEach(() => {
  sessionStorage.clear();
});

describe('setQueuedEducation + getQueuedEducation', () => {
  test('stores and retrieves a valid education entry', () => {
    setQueuedEducation(validEducation);
    const result = getQueuedEducation();
    expect(result).toEqual(validEducation);
  });

  test('returns null when nothing is queued', () => {
    expect(getQueuedEducation()).toBeNull();
  });

  test('returns null for invalid JSON in sessionStorage', () => {
    sessionStorage.setItem('queuedEducation', 'not-json');
    expect(getQueuedEducation()).toBeNull();
  });

  test('returns null for data that fails schema validation', () => {
    sessionStorage.setItem('queuedEducation', JSON.stringify({ bad: 'data' }));
    expect(getQueuedEducation()).toBeNull();
  });

  test('preserves optional fields like schoolName and educationLevel', () => {
    const full: Education = {
      ...validEducation,
      schoolName: 'CU Boulder',
      educationLevel: 'Bachelors',
      graduationDate: '2020',
    };
    setQueuedEducation(full);
    const result = getQueuedEducation();
    expect(result?.schoolName).toBe('CU Boulder');
    expect(result?.educationLevel).toBe('Bachelors');
    expect(result?.graduationDate).toBe('2020');
  });
});

describe('clearQueuedEducation', () => {
  test('removes queued education from sessionStorage', () => {
    setQueuedEducation(validEducation);
    clearQueuedEducation();
    expect(getQueuedEducation()).toBeNull();
  });

  test('does nothing when no education is queued', () => {
    // Should not throw
    clearQueuedEducation();
    expect(getQueuedEducation()).toBeNull();
  });
});
