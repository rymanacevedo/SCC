import { describe, expect, test } from 'bun:test';
import { BaseExperienceSchema } from '../routes/builder/experience';

const validExperience = {
  jobId: 'abc-123',
  jobTitle: 'Software Engineer',
  employer: 'Acme Corp',
  city: 'Denver',
  state: 'CO',
  startDate: '2023-01',
  currentlyEmployed: true,
};

describe('BaseExperienceSchema city field', () => {
  test('accepts a valid city string', () => {
    const result = BaseExperienceSchema.safeParse(validExperience);
    expect(result.success).toBe(true);
  });

  test('rejects empty city string', () => {
    const result = BaseExperienceSchema.safeParse({
      ...validExperience,
      city: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const cityErrors = result.error.flatten().fieldErrors.city;
      expect(cityErrors).toBeDefined();
      expect(cityErrors).toContain('City is required.');
    }
  });

  test('rejects missing city field', () => {
    const { city, ...withoutCity } = validExperience;
    const result = BaseExperienceSchema.safeParse(withoutCity);
    expect(result.success).toBe(false);
  });
});

describe('BaseExperienceSchema state field', () => {
  test('accepts a valid state abbreviation', () => {
    const result = BaseExperienceSchema.safeParse(validExperience);
    expect(result.success).toBe(true);
  });

  test('rejects empty state string', () => {
    const result = BaseExperienceSchema.safeParse({
      ...validExperience,
      state: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const stateErrors = result.error.flatten().fieldErrors.state;
      expect(stateErrors).toBeDefined();
      expect(stateErrors).toContain('State is required.');
    }
  });

  test('rejects missing state field', () => {
    const { state, ...withoutState } = validExperience;
    const result = BaseExperienceSchema.safeParse(withoutState);
    expect(result.success).toBe(false);
  });
});

describe('BaseExperienceSchema city and state together', () => {
  test('rejects when both city and state are empty', () => {
    const result = BaseExperienceSchema.safeParse({
      ...validExperience,
      city: '',
      state: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.city).toBeDefined();
      expect(errors.state).toBeDefined();
    }
  });

  test('validates city and state independently (city valid, state empty)', () => {
    const result = BaseExperienceSchema.safeParse({
      ...validExperience,
      city: 'Denver',
      state: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.city).toBeUndefined();
      expect(errors.state).toBeDefined();
    }
  });

  test('validates city and state independently (state valid, city empty)', () => {
    const result = BaseExperienceSchema.safeParse({
      ...validExperience,
      city: '',
      state: 'CO',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.city).toBeDefined();
      expect(errors.state).toBeUndefined();
    }
  });

  test('accepts full state name as state value', () => {
    const result = BaseExperienceSchema.safeParse({
      ...validExperience,
      state: 'Colorado',
    });
    expect(result.success).toBe(true);
  });
});
