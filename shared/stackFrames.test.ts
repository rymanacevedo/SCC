import { describe, expect, test } from 'bun:test';
import {
  sanitizeStackTrace,
  stackSummary,
  stackWithHeader,
} from './stackFrames.ts';

// Keys, assembled at runtime so none sits in source.
const DASHED_KEY = ['sk', 'live', 'abcdefghijklmnopqrstuvwx'].join('-');
const AKIA_NAME = ['AKIA', 'IOSFODNN7EXAMPLE'].join('');

describe('sanitizeStackTrace', () => {
  test('a real V8 stack comes out as clean canonical frames', () => {
    const stack = [
      "TypeError: Cannot read properties of undefined (reading 'name')",
      '    at saveSummary (https://scc.example/assets/main-abcdef12.js?v=1a2b:12:34)',
      '    at https://scc.example/assets/index-Bx9q.js:1:113',
      '    at Array.map (<anonymous>)',
      '    at async Promise.all (index 0)',
      '    at new Builder (/srv/app/src/builder.ts:40:7)',
      '    at Object.<anonymous> [as run] (node:internal/vm:219:10)',
      '    at [eval]:1:121',
    ].join('\n');
    expect(sanitizeStackTrace(stack, 8_000)).toBe(
      [
        'TypeError',
        '    at saveSummary (https://app.invalid/assets/main-abcdef12.js:12:34)',
        '    at <anonymous> (https://app.invalid/assets/index-Bx9q.js:1:113)',
        '    at Array.map (<anonymous>)',
        '    at async Promise.all (index 0)',
        '    at new Builder (/srv/app/src/builder.ts:40:7)',
        '    at Object.<anonymous> [as run] (node:internal/vm:219:10)',
        '    at <anonymous> ([eval]:1:121)',
      ].join('\n'),
    );
  });

  test('Firefox and Safari frames come out in the same canonical form', () => {
    const stack = [
      'saveSummary@https://scc.example/assets/main.js:12:34',
      'Builder/<@https://scc.example/assets/main.js:5:6',
      '@https://scc.example/assets/main.js?x=1#y:7:8',
      'global code@https://scc.example/:1:1',
      '[native code]',
    ].join('\n');
    expect(sanitizeStackTrace(stack, 8_000)).toBe(
      [
        '    at saveSummary (https://app.invalid/assets/main.js:12:34)',
        '    at <anonymous> (https://app.invalid/assets/main.js:5:6)',
        '    at <anonymous> (https://app.invalid/assets/main.js:7:8)',
        '    at global code (https://app.invalid/:1:1)',
        '    [frame omitted]',
      ].join('\n'),
    );
  });

  test('lines that are not frames collapse into one [frame omitted]', () => {
    const stack = [
      'Error: Save failed for jane.doe@example.com',
      '    request headers: authorization=basic short-secret',
      '    Cookie: theme=dark; sid=private-value',
      '    at retry (https://scc.example/a.js:9:9)',
      '    GET https://scc.example/a(b)?q=private-value phone:555-765-4321',
      '    at fn (https://alice:hunter2@scc.example/a.js?token=abc123:1:2)',
      '    at fn (jane@example.com:1:2)',
      '    at hunter2 secret! (https://scc.example/a.js:1:2)',
    ].join('\n');
    expect(sanitizeStackTrace(stack, 8_000)).toBe(
      [
        'Error',
        '    [frame omitted]',
        '    at retry (https://app.invalid/a.js:9:9)',
        '    [frame omitted]',
        '    at fn (https://app.invalid/a.js:1:2)',
        '    at fn ([redacted]:1:2)',
        '    at <anonymous> (https://app.invalid/a.js:1:2)',
      ].join('\n'),
    );
  });

  test('the header line is reduced to a known error class name; its message is dropped', () => {
    expect(sanitizeStackTrace('apiKey: short-secret', 8_000)).toBe('Error');
    expect(
      sanitizeStackTrace(
        'TypeError: correcthorse\n    at f (https://scc.example/a.js:1:2)',
        8_000,
      ),
    ).toBe('TypeError\n    at f (https://app.invalid/a.js:1:2)');
    // Error-shaped is not enough: only a known class name is kept.
    const key = ['sk', 'live', 'abcdefghijklmnopqrstuvwx'].join('_');
    expect(sanitizeStackTrace(`Token_${key}Error: x`, 8_000)).toBe('Error');
    expect(
      sanitizeStackTrace('DOMException: The operation was aborted.', 8_000),
    ).toBe('DOMException');
    expect(sanitizeStackTrace('ChunkLoadError', 8_000)).toBe('ChunkLoadError');
  });

  test('stackSummary reads the error name and the top frames', () => {
    const stack = sanitizeStackTrace(
      [
        'TypeError: Boom',
        '    at a (https://scc.example/a.js:1:2)',
        '    random line',
        '    at b (https://scc.example/b.js:3:4)',
        '    at c (https://scc.example/c.js:5:6)',
      ].join('\n'),
      8_000,
    );
    expect(stackSummary(stack, 2)).toEqual({
      name: 'TypeError',
      frames: [
        '    at a (https://app.invalid/a.js:1:2)',
        '    at b (https://app.invalid/b.js:3:4)',
      ],
    });
    expect(
      stackSummary('    at a (https://scc.example/a.js:1:2)', 5).name,
    ).toBe('');
  });

  test('a function name must be an identifier shape, else <anonymous>', () => {
    const stack = [
      'Error: Broken',
      '    at token abc123def 5551234567 (https://scc.example/a.js:1:2)',
      'user 5551234567@https://scc.example/a.js:3:4',
      '    at user5551234567 (https://scc.example/a.js:5:6)',
      '    at hunter2 (https://scc.example/a.js:7:8)',
      '    at new Builder (https://scc.example/a.js:9:9)',
      '    at async loadUser (https://scc.example/a.js:9:9)',
      '    at Object.<anonymous> [as run] (https://scc.example/a.js:9:9)',
    ].join('\n');
    expect(sanitizeStackTrace(stack, 8_000)).toBe(
      [
        'Error',
        '    at <anonymous> (https://app.invalid/a.js:1:2)',
        '    at <anonymous> (https://app.invalid/a.js:3:4)',
        '    at <anonymous> (https://app.invalid/a.js:5:6)',
        '    at <anonymous> (https://app.invalid/a.js:7:8)',
        '    at new Builder (https://app.invalid/a.js:9:9)',
        '    at async loadUser (https://app.invalid/a.js:9:9)',
        '    at Object.<anonymous> [as run] (https://app.invalid/a.js:9:9)',
      ].join('\n'),
    );
  });

  test('a file keeps only an allowlisted scheme; a nested URL loses its host', () => {
    const stack = [
      'Error',
      '    at a (blob:https://janedoe.example.com/token.js:1:2)',
      '    at b (webpack://janedoe-app/src/main.ts:3:4)',
      '    at c (webpack-internal:///./src/x.ts:5:6)',
      '    at d (chrome-extension://abcdefghijklmnopabcdefghijklmnop/x.js:7:8)',
      '    at e (file:///srv/app/x.js:9:9)',
      '    at f (node:internal/vm:1:2)',
      `    at g (${DASHED_KEY}:module.js:1:2)`,
      '    at h (javascript:alert(1):1:2)',
      '    at i (https://scc.example/a.js:1:2)',
    ].join('\n');
    const sanitized = sanitizeStackTrace(stack, 8_000);
    expect(sanitized).not.toContain('janedoe');
    expect(sanitized).not.toContain(DASHED_KEY);
    expect(sanitized).toBe(
      [
        'Error',
        '    at a (blob:https://app.invalid/token.js:1:2)',
        '    at b (webpack://app.invalid/src/main.ts:3:4)',
        '    at c (webpack-internal:///src/x.ts:5:6)',
        '    at d (chrome-extension://app.invalid/x.js:7:8)',
        '    at e (file:///srv/app/x.js:9:9)',
        '    at f (node:internal/vm:1:2)',
        // An unknown scheme omits the frame: dropping just the scheme would
        // leave what followed it to be read as a path.
        '    [frame omitted]',
        '    at i (https://app.invalid/a.js:1:2)',
      ].join('\n'),
    );
  });

  test('the digit cap applies to the whole function name and alias, not just each part', () => {
    for (const name of [
      'Object.555.123.4567',
      'run [as x_555_123_4567]',
      'a1.b2.c3.d4.e5',
    ])
      expect(
        sanitizeStackTrace(
          `    at ${name} (https://scc.example/a.js:1:2)`,
          8_000,
        ),
      ).toBe('    at <anonymous> (https://app.invalid/a.js:1:2)');
  });

  test('an authority in a stack location is never kept, not even as a path segment', () => {
    const stack = [
      'Error',
      // A network-path reference: V8 prints eval'd code this way.
      '    at eval (//janedoe.example.com/script.js:1:7)',
      // A nested URL inside any scheme but blob: omits the frame.
      '    at a (node:https://janedoe.example.com/a.js:1:2)',
      '    at b (webpack:https://janedoe.example.com/a.js:3:4)',
      '    at c (file:https://janedoe.example.com/a.js:5:6)',
      // A hosted scheme without `//` would read its host as a path.
      '    at d (chrome-extension:janedoe/a.js:7:8)',
      '    at e (file://janedoe-laptop/srv/a.js:9:9)',
      '    at f (https://scc.example/a.js:1:2)',
    ].join('\n');
    const sanitized = sanitizeStackTrace(stack, 8_000);
    expect(sanitized).not.toContain('janedoe');
    expect(sanitized).toBe(
      [
        'Error',
        '    at eval (https://app.invalid/script.js:1:7)',
        '    [frame omitted]',
        '    at e (file://app.invalid/srv/a.js:9:9)',
        '    at f (https://app.invalid/a.js:1:2)',
      ].join('\n'),
    );
  });

  test('a random-looking or key-like function name becomes <anonymous>', () => {
    for (const name of [
      'XkfQpLmZr9Ab',
      AKIA_NAME,
      `Object.${AKIA_NAME}`,
      `run [as XkfQpLmZr9Ab]`,
    ])
      expect(
        sanitizeStackTrace(
          `    at ${name} (https://scc.example/a.js:1:2)`,
          8_000,
        ),
      ).toBe('    at <anonymous> (https://app.invalid/a.js:1:2)');
  });

  test('stackWithHeader names a headerless stack, and leaves a V8 one alone', () => {
    expect(stackWithHeader('TypeError', 'f@https://scc.example/a.js:1:2')).toBe(
      'TypeError\nf@https://scc.example/a.js:1:2',
    );
    expect(stackWithHeader('TypeError', undefined)).toBe('TypeError');
    const v8 = 'TypeError: x\n    at f (https://scc.example/a.js:1:2)';
    expect(stackWithHeader('TypeError', v8)).toBe(v8);
  });

  test('a key-shaped function name, dotted part or alias becomes <anonymous>', () => {
    const key = ['sk', 'live', 'abcdefghijklmnopqrstuvwx'].join('_');
    const stack = [
      // A normal message, then a frame-shaped line holding the key.
      'Error: hi',
      `    at ${key} (https://scc.example/a.js:1:2)`,
      `    at Object.${key} (https://scc.example/a.js:3:4)`,
      `    at run [as ${key}] (https://scc.example/a.js:5:6)`,
      `${key}@https://scc.example/a.js:7:8`,
    ].join('\n');
    const sanitized = sanitizeStackTrace(stack, 8_000);
    expect(sanitized).not.toContain(key);
    expect(sanitized).toBe(
      [
        'Error',
        '    at <anonymous> (https://app.invalid/a.js:1:2)',
        '    at <anonymous> (https://app.invalid/a.js:3:4)',
        '    at <anonymous> (https://app.invalid/a.js:5:6)',
        '    at <anonymous> (https://app.invalid/a.js:7:8)',
      ].join('\n'),
    );
  });

  test('the first line is read as a header before it is tried as a frame', () => {
    // `Error: …@host:1:2` would otherwise parse as a Firefox frame.
    expect(
      sanitizeStackTrace(
        'Error: failed for jane@example.com:1:2\n    at f (https://scc.example/a.js:1:2)',
        8_000,
      ),
    ).toBe('Error\n    at f (https://app.invalid/a.js:1:2)');
    // A Firefox stack has no header: its first line is still a frame.
    expect(
      sanitizeStackTrace('saveSummary@https://scc.example/a.js:1:2', 8_000),
    ).toBe('    at saveSummary (https://app.invalid/a.js:1:2)');
  });

  test('a file path segment with 5+ digits in total becomes [redacted]', () => {
    const stack = [
      'Error: Broken',
      '    at call (https://scc.example/call/555-123-4567/a.js:1:2)',
      '    at call (/srv/users/555.123.4567/a.js:3:4)',
      '    at main (https://scc.example/assets/index-C4kL9x.js:5:6)',
    ].join('\n');
    expect(sanitizeStackTrace(stack, 8_000)).toBe(
      [
        'Error',
        '    at call (https://app.invalid/call/[redacted]/a.js:1:2)',
        '    at call (/srv/users/[redacted]/a.js:3:4)',
        '    at main (https://app.invalid/assets/index-C4kL9x.js:5:6)',
      ].join('\n'),
    );
  });

  test('an over-long stack is cut at a frame boundary with a marker', () => {
    const frame = '    at frame (https://scc.example/a.js:1:2)';
    const sanitized = sanitizeStackTrace(
      `Error: Broken\n${`${frame}\n`.repeat(5_000)}`,
      4_000,
    );
    expect(sanitized.endsWith('… [truncated]')).toBe(true);
    expect(sanitized.length).toBeLessThanOrEqual(4_000);
  });

  test('is linear on adversarial input', () => {
    for (const input of [
      `at ${'('.repeat(32_000)}`,
      `at ${' ('.repeat(16_000)})`,
      '@'.repeat(32_000),
      `${'at a (b:1:2)\n'.repeat(2_500)}`,
      `x${':1'.repeat(16_000)}`,
    ]) {
      const started = performance.now();
      sanitizeStackTrace(input, 8_000);
      expect(performance.now() - started).toBeLessThan(250);
    }
  });
});
