import { expect, test } from 'bun:test';
import { formatExperienceLocation } from './experience';

test('formats experience location as city and state abbreviation', () => {
  expect(
    formatExperienceLocation({
      city: 'Denver',
      state: 'CO',
    }),
  ).toBe('Denver, CO');
});
