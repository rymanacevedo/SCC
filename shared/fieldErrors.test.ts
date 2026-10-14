import { expect, test } from 'bun:test';
import { fieldErrors } from './fieldErrors.ts';
import { z } from './zod.ts';

test('folds nested Field errors and Form errors without dropping messages', () => {
  const schema = z
    .object({
      entries: z.array(
        z.object({
          title: z.string().check(z.minLength(1, 'Title required')),
        }),
      ),
      _form: z.string().check(z.minLength(1, 'Field named _form required')),
    })
    .check(
      z.superRefine((_, ctx) => {
        ctx.addIssue({ code: 'custom', message: 'Submission rejected' });
      }),
    );
  const result = schema.safeParse({
    entries: [{ title: '' }, { title: '' }],
    _form: '',
  });
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(fieldErrors(result.error)).toEqual({
      entries: ['Title required', 'Title required'],
      _form: ['Field named _form required', 'Submission rejected'],
    });
  }
});

test('does not add _form when only Field errors exist', () => {
  const result = z
    .object({ name: z.string().check(z.minLength(1, 'Name required')) })
    .safeParse({ name: '' });
  if (result.success) throw new Error('Expected validation to fail');
  expect(fieldErrors(result.error)).toEqual({ name: ['Name required'] });
});
