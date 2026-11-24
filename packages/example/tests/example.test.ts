import { expect, test } from 'bun:test';
import { formatGreeting } from '../index.ts';

test('greets a named person with tidied whitespace', () => {
  expect(formatGreeting('  Ada   Lovelace ')).toBe('Hello, Ada Lovelace!');
});

test('greets a nameless person generically', () => {
  expect(formatGreeting('   ')).toBe('Hello, there!');
});
