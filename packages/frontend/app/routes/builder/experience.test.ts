import { describe, expect, test } from 'bun:test';
import { BaseExperienceSchema } from '../../utils/schemas/experience';

const validExperience = {
  jobId: 'job-1',
  jobTitle: 'Developer',
  employer: 'Example Co',
  city: 'Denver',
  state: 'CO',
  startDate: '2024-01',
  endDate: '2024-06',
  currentlyEmployed: false,
};

describe('BaseExperienceSchema', () => {
  test('accepts valid city and state values independently', () => {
    const parsed = BaseExperienceSchema.parse(validExperience);

    expect(parsed.city).toBe('Denver');
    expect(parsed.state).toBe('CO');
  });

  test('rejects an empty city', () => {
    const result = BaseExperienceSchema.safeParse({
      ...validExperience,
      city: '',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.city).toEqual([
        'City is required.',
      ]);
    }
  });

  test('rejects an empty state', () => {
    const result = BaseExperienceSchema.safeParse({
      ...validExperience,
      state: '',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.state).toEqual([
        'State is required.',
      ]);
    }
  });
});
