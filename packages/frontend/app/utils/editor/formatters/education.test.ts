import { describe, expect, test } from 'bun:test';
import { formatEducationString } from './education';

describe('formatEducationString', () => {
  test('renders certificate entries as only certificate', () => {
    expect(
      formatEducationString({
        schoolName: 'Provider B',
        educationLevel: 'Certificate',
        degree: 'Certificate',
        location: '',
        graduationDate: '2024',
        currentlyEnrolled: false,
      }),
    ).toBe('Certificate');
  });

  test('formats a degreed entry with all fields', () => {
    expect(
      formatEducationString({
        schoolName: 'University A',
        educationLevel: 'Bachelors',
        degree: 'Computer Science',
        location: 'Denver, CO',
        graduationDate: '2020',
        currentlyEnrolled: false,
      }),
    ).toBe('Computer Science | Bachelors | University A | Denver, CO');
  });
});
