import { describe, expect, test } from 'bun:test';
import { fencedBlock, inlineCode } from './markdown.ts';

describe('fencedBlock', () => {
  test('wraps plain text in a three-backtick fence', () => {
    expect(fencedBlock('Save failed\non step two')).toBe(
      '```\nSave failed\non step two\n```',
    );
  });

  test('uses a fence longer than any backtick run in the text', () => {
    expect(fencedBlock('a\n```\n## Heading\n`````')).toBe(
      '``````\na\n```\n## Heading\n`````\n``````',
    );
  });
});

describe('inlineCode', () => {
  test('wraps plain text in single backticks', () => {
    expect(inlineCode('Chunk failed')).toBe('`Chunk failed`');
  });

  test('uses a delimiter longer than any backtick run in the text', () => {
    expect(inlineCode('a``b')).toBe('```a``b```');
  });

  test('pads text that starts or ends with a backtick', () => {
    expect(inlineCode('`x')).toBe('`` `x ``');
    expect(inlineCode('x`')).toBe('`` x` ``');
  });

  test('pads text that starts and ends with a space so neither is stripped', () => {
    expect(inlineCode(' x ')).toBe('`  x  `');
  });

  test('renders empty text as a code span holding one space, since two backticks are not a code span', () => {
    expect(inlineCode('')).toBe('` `');
  });

  test('turns every line break into a space', () => {
    expect(inlineCode('one\ntwo\r\nthree\rfour')).toBe('`one two three four`');
  });

  test('turns Unicode line and paragraph separators and NEL into spaces', () => {
    expect(inlineCode('one\u2028two\u2029three\u0085four')).toBe(
      '`one two three four`',
    );
  });
});
