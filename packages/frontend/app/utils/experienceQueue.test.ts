import { afterEach, beforeAll, describe, expect, test } from 'bun:test';
import {
  type Experience,
  clearQueuedExperience,
  getQueuedExperience,
  setQueuedExperience,
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

const validExperience: Experience = {
  jobId: 'abc-123',
  jobTitle: 'Software Engineer',
  employer: 'Acme Corp',
  city: 'Denver',
  state: 'CO',
  startDate: new Date('2023-01-01'),
  currentlyEmployed: true,
};

afterEach(() => {
  sessionStorage.clear();
});

describe('setQueuedExperience + getQueuedExperience', () => {
  test('stores and retrieves a valid experience entry', () => {
    setQueuedExperience(validExperience);
    const result = getQueuedExperience();
    expect(result).not.toBeNull();
    expect(result?.city).toBe('Denver');
    expect(result?.state).toBe('CO');
    expect(result?.jobTitle).toBe('Software Engineer');
  });

  test('returns null when nothing is queued', () => {
    expect(getQueuedExperience()).toBeNull();
  });

  test('returns null for invalid JSON in sessionStorage', () => {
    sessionStorage.setItem('queuedExperience', 'not-json');
    expect(getQueuedExperience()).toBeNull();
  });

  test('returns null for data that fails schema validation', () => {
    sessionStorage.setItem('queuedExperience', JSON.stringify({ bad: 'data' }));
    expect(getQueuedExperience()).toBeNull();
  });

  test('preserves city and state as separate fields', () => {
    setQueuedExperience(validExperience);
    const result = getQueuedExperience();
    expect(result?.city).toBe('Denver');
    expect(result?.state).toBe('CO');
  });

  test('preserves optional details field', () => {
    const withDetails: Experience = {
      ...validExperience,
      details: ['Built APIs', 'Led team of 5'],
    };
    setQueuedExperience(withDetails);
    const result = getQueuedExperience();
    expect(result?.details).toEqual(['Built APIs', 'Led team of 5']);
  });
});

describe('clearQueuedExperience', () => {
  test('removes queued experience from sessionStorage', () => {
    setQueuedExperience(validExperience);
    clearQueuedExperience();
    expect(getQueuedExperience()).toBeNull();
  });

  test('does nothing when no experience is queued', () => {
    // Should not throw
    clearQueuedExperience();
    expect(getQueuedExperience()).toBeNull();
  });
});
