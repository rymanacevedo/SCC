import { describe, expect, test } from 'bun:test';
import { sanitizeStackTrace } from './stackFrames.ts';

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
        "TypeError: Cannot read properties of undefined (reading 'name')",
        '    at saveSummary (https://scc.example/assets/main-abcdef12.js:12:34)',
        '    at <anonymous> (https://scc.example/assets/index-Bx9q.js:1:113)',
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
        '    at saveSummary (https://scc.example/assets/main.js:12:34)',
        '    at <anonymous> (https://scc.example/assets/main.js:5:6)',
        '    at <anonymous> (https://scc.example/assets/main.js:7:8)',
        '    at global code (https://scc.example/:1:1)',
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
        'Error: Save failed for [redacted]',
        '    [frame omitted]',
        '    at retry (https://scc.example/a.js:9:9)',
        '    [frame omitted]',
        '    at fn (https://scc.example/a.js:1:2)',
        '    at fn ([redacted]:1:2)',
        '    at <anonymous> (https://scc.example/a.js:1:2)',
      ].join('\n'),
    );
  });

  test('the header line keeps credential context: the whole line is free text', () => {
    expect(sanitizeStackTrace('apiKey: short-secret', 8_000)).toBe(
      'apiKey: [redacted]',
    );
    expect(
      sanitizeStackTrace(
        'TokenError: correcthorse\n    at f (https://scc.example/a.js:1:2)',
        8_000,
      ),
    ).toBe('TokenError: [redacted]\n    at f (https://scc.example/a.js:1:2)');
    expect(
      sanitizeStackTrace('DOMException: The operation was aborted.', 8_000),
    ).toBe('DOMException: The operation was aborted.');
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
        'Error: Broken',
        '    at <anonymous> (https://scc.example/a.js:1:2)',
        '    at <anonymous> (https://scc.example/a.js:3:4)',
        '    at <anonymous> (https://scc.example/a.js:5:6)',
        '    at hunter2 (https://scc.example/a.js:7:8)',
        '    at new Builder (https://scc.example/a.js:9:9)',
        '    at async loadUser (https://scc.example/a.js:9:9)',
        '    at Object.<anonymous> [as run] (https://scc.example/a.js:9:9)',
      ].join('\n'),
    );
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
        'Error: Broken',
        '    at call (https://scc.example/call/[redacted]/a.js:1:2)',
        '    at call (/srv/users/[redacted]/a.js:3:4)',
        '    at main (https://scc.example/assets/index-C4kL9x.js:5:6)',
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
    expect(sanitized.length).toBeLessThanOrEqual(
      4_000 + '… [truncated]'.length,
    );
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
