import { expect, test } from 'bun:test';
import { usStates } from './usStates';

test('usStates contains all 50 states', () => {
  expect(usStates).toHaveLength(50);
});

test('each state has a 2-letter value and a label', () => {
  for (const state of usStates) {
    expect(state.value).toMatch(/^[A-Z]{2}$/);
    expect(state.label.length).toBeGreaterThan(0);
  }
});
