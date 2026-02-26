import { describe, expect, test } from 'bun:test';
import { formatPhone, stripNonDigits } from './usePhoneMask';

describe('stripNonDigits', () => {
  test('returns empty string for empty input', () => {
    expect(stripNonDigits('')).toBe('');
  });

  test('strips non-digit characters', () => {
    expect(stripNonDigits('abc123def456')).toBe('123456');
    expect(stripNonDigits('(555) 123-4567')).toBe('5551234567');
    expect(stripNonDigits('---')).toBe('');
  });

  test('caps at 10 digits', () => {
    expect(stripNonDigits('12345678901234')).toBe('1234567890');
  });

  test('passes through plain digits unchanged', () => {
    expect(stripNonDigits('5551234567')).toBe('5551234567');
  });

  test('handles mixed input with more than 10 digits', () => {
    expect(stripNonDigits('1-800-555-1234-9999')).toBe('1800555123');
  });
});

describe('formatPhone', () => {
  test('returns empty string for empty input', () => {
    expect(formatPhone('')).toBe('');
  });

  test('returns digits as-is for 1-3 digits', () => {
    expect(formatPhone('5')).toBe('5');
    expect(formatPhone('55')).toBe('55');
    expect(formatPhone('555')).toBe('555');
  });

  test('inserts first dash after 3 digits', () => {
    expect(formatPhone('5551')).toBe('555-1');
    expect(formatPhone('55512')).toBe('555-12');
    expect(formatPhone('555123')).toBe('555-123');
  });

  test('inserts second dash after 6 digits', () => {
    expect(formatPhone('5551234')).toBe('555-123-4');
    expect(formatPhone('55512345')).toBe('555-123-45');
    expect(formatPhone('555123456')).toBe('555-123-456');
    expect(formatPhone('5551234567')).toBe('555-123-4567');
  });
});

describe('formatPhone + stripNonDigits together', () => {
  test('pasting a full formatted number produces correct output', () => {
    const pasted = '555-123-4567';
    expect(formatPhone(stripNonDigits(pasted))).toBe('555-123-4567');
  });

  test('pasting a raw 10-digit number produces correct output', () => {
    const pasted = '5551234567';
    expect(formatPhone(stripNonDigits(pasted))).toBe('555-123-4567');
  });

  test('pasting a number with parens and spaces formats correctly', () => {
    const pasted = '(555) 123 4567';
    expect(formatPhone(stripNonDigits(pasted))).toBe('555-123-4567');
  });

  test('simulates backspace from full number', () => {
    // User has "555-123-4567", deletes last char -> "555-123-456"
    const afterDelete = '555-123-456';
    expect(formatPhone(stripNonDigits(afterDelete))).toBe('555-123-456');
  });

  test('simulates backspace deleting a dash', () => {
    // User has "555-123-4567", cursor is after first dash, deletes the dash
    // Browser sends "555123-4567" -> strip -> "5551234567" -> format -> "555-123-4567"
    const afterDashDelete = '555123-4567';
    expect(formatPhone(stripNonDigits(afterDashDelete))).toBe('555-123-4567');
  });

  test('handles letters typed into phone field', () => {
    const withLetters = '555abc1234';
    expect(formatPhone(stripNonDigits(withLetters))).toBe('555-123-4');
  });

  test('truncates pasted number longer than 10 digits', () => {
    const long = '15551234567890';
    expect(formatPhone(stripNonDigits(long))).toBe('155-512-3456');
  });
});
