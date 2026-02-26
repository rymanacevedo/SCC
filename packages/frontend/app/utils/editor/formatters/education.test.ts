import { describe, expect, test } from 'bun:test';
import { formatEducationString } from './education';

describe('formatEducationString', () => {
  test('returns empty string for undefined input', () => {
    expect(formatEducationString(undefined)).toBe('');
  });

  test('joins all fields with pipe separator', () => {
    const result = formatEducationString({
      degree: 'Bachelor of Science',
      educationLevel: 'Bachelors',
      schoolName: 'MIT',
      location: 'Cambridge, MA',
    });
    expect(result).toBe(
      'Bachelor of Science | Bachelors | MIT | Cambridge, MA',
    );
  });

  test('omits missing fields', () => {
    const result = formatEducationString({
      degree: 'Certificate',
      educationLevel: 'Certificate',
      schoolName: 'Coursera',
    });
    expect(result).toBe('Certificate | Certificate | Coursera');
  });

  test('omits empty string fields', () => {
    const result = formatEducationString({
      degree: 'Diploma',
      educationLevel: 'High School',
      schoolName: '',
      location: 'Denver, CO',
    });
    expect(result).toBe('Diploma | High School | Denver, CO');
  });

  test('returns single field when only one is present', () => {
    const result = formatEducationString({
      schoolName: 'Harvard',
    });
    expect(result).toBe('Harvard');
  });

  test('returns empty string when all fields are empty or missing', () => {
    const result = formatEducationString({});
    expect(result).toBe('');
  });
});
