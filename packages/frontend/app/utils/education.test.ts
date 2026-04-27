import { describe, expect, test } from 'bun:test';
import { getEducationGraduationLabel, sortEducationEntries } from './education';

describe('sortEducationEntries', () => {
  test('sorts currently enrolled entries first, then graduation year descending', () => {
    const sorted = sortEducationEntries([
      {
        schoolName: 'State College',
        educationLevel: 'Bachelors',
        degree: 'Biology',
        location: 'Denver, CO',
        graduationDate: '2020',
        currentlyEnrolled: false,
      },
      {
        schoolName: 'Online Program',
        educationLevel: 'Certificate',
        degree: 'Certificate',
        location: '',
        graduationDate: '2023',
        currentlyEnrolled: true,
      },
      {
        schoolName: 'Community College',
        educationLevel: 'Associates',
        degree: 'Design',
        location: 'Boulder, CO',
        graduationDate: '2022',
        currentlyEnrolled: false,
      },
    ]);

    expect(sorted.map((entry) => entry.schoolName)).toEqual([
      'Online Program',
      'Community College',
      'State College',
    ]);
  });
});

describe('getEducationGraduationLabel', () => {
  test('returns currently enrolled when applicable', () => {
    expect(
      getEducationGraduationLabel({
        currentlyEnrolled: true,
        graduationDate: '2026',
      }),
    ).toBe('Currently Enrolled');
  });
});
