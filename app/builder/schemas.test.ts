import { expect, test } from 'bun:test';
import { dataFor, errorsFor } from '../../test/validation.ts';
import { detailsFormSchema } from './details.ts';
import { skillsFormSchema } from './skills.ts';

// Expected values were captured from the full `zod` build before the client moved to `zod/mini`.
test('details drop blank and repeated answers and cap at six', () => {
  expect(
    dataFor(detailsFormSchema, { jobId: 'job-1', details: 'one' }),
  ).toEqual({ jobId: 'job-1', details: ['one'] });
  expect(
    errorsFor(detailsFormSchema, {
      jobId: 'job-1',
      details: ['1', '2', '3', '4', '5', '6', '7', ' ', '1'],
    }),
  ).toEqual({ details: ['You can add up to six details.'] });
});

test('skills normalize repeated fields and cap the total at six', () => {
  expect(
    dataFor(skillsFormSchema, {
      expertRecommended: 'Typing',
      other: undefined,
    }),
  ).toEqual({ expertRecommended: ['Typing'], other: [] });
  expect(
    errorsFor(skillsFormSchema, {
      expertRecommended: ['a', 'b', 'c', 'd'],
      other: ['e', 'f', 'g'],
    }),
  ).toEqual({ other: ['You can add up to six skills.'] });
});
