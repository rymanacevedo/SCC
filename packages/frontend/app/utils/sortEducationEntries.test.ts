import { describe, expect, test } from 'bun:test';
import { sortEducationEntries } from './user';

describe('sortEducationEntries', () => {
  test('returns empty array for empty input', () => {
    expect(sortEducationEntries([])).toEqual([]);
  });

  test('returns single entry unchanged', () => {
    const entries = [{ graduationDate: '2020', currentlyEnrolled: false }];
    expect(sortEducationEntries(entries)).toEqual(entries);
  });

  test('does not mutate the original array', () => {
    const entries = [{ graduationDate: '2018' }, { graduationDate: '2022' }];
    const original = [...entries];
    sortEducationEntries(entries);
    expect(entries).toEqual(original);
  });

  test('sorts by graduation year descending (newest first)', () => {
    const entries = [
      { graduationDate: '2018' },
      { graduationDate: '2022' },
      { graduationDate: '2020' },
    ];
    const sorted = sortEducationEntries(entries);
    expect(sorted).toEqual([
      { graduationDate: '2022' },
      { graduationDate: '2020' },
      { graduationDate: '2018' },
    ]);
  });

  test('sorts currently enrolled entries to the top', () => {
    const entries = [
      { graduationDate: '2024', currentlyEnrolled: false },
      { graduationDate: '2020', currentlyEnrolled: true },
    ];
    const sorted = sortEducationEntries(entries);
    expect(sorted[0].currentlyEnrolled).toBe(true);
    expect(sorted[1].currentlyEnrolled).toBe(false);
  });

  test('currently enrolled entries sort above even newer graduation dates', () => {
    const entries = [
      { graduationDate: '2025', currentlyEnrolled: false },
      { graduationDate: '2020', currentlyEnrolled: true },
      { graduationDate: '2018', currentlyEnrolled: false },
    ];
    const sorted = sortEducationEntries(entries);
    expect(sorted[0].currentlyEnrolled).toBe(true);
    expect(sorted[1].graduationDate).toBe('2025');
    expect(sorted[2].graduationDate).toBe('2018');
  });

  test('handles missing graduationDate by treating as 0', () => {
    const entries = [{ graduationDate: undefined }, { graduationDate: '2020' }];
    const sorted = sortEducationEntries(entries);
    expect(sorted[0].graduationDate).toBe('2020');
    expect(sorted[1].graduationDate).toBeUndefined();
  });

  test('handles multiple currently enrolled entries', () => {
    const entries = [
      { graduationDate: '2018', currentlyEnrolled: false },
      { graduationDate: '2023', currentlyEnrolled: true },
      { graduationDate: '2025', currentlyEnrolled: true },
    ];
    const sorted = sortEducationEntries(entries);
    // Both enrolled entries at top, sorted by year desc among themselves
    expect(sorted[0].graduationDate).toBe('2025');
    expect(sorted[0].currentlyEnrolled).toBe(true);
    expect(sorted[1].graduationDate).toBe('2023');
    expect(sorted[1].currentlyEnrolled).toBe(true);
    expect(sorted[2].graduationDate).toBe('2018');
    expect(sorted[2].currentlyEnrolled).toBe(false);
  });
});
