import { describe, expect, test } from 'bun:test';
import { dataFor, errorsFor } from '../../test/validation.ts';
import { userIssueReportSchema } from '../errorReporting.ts';
import { BaseEducationSchema } from './education.ts';
import { BaseExperienceSchema } from './experience.ts';
import { generationRequestSchema } from './generation.ts';
import { PersonalInfoSchema } from './info.ts';
import { SummarySchema } from './summary.ts';

// Expected messages were captured from the full `zod` build before the client moved to `zod/mini`;
// Zod's own English messages reach Users and the Worker's 400 bodies, so they must not change.
describe('Generation request', () => {
  test('keeps Zod default messages in the field errors', () => {
    expect(errorsFor(generationRequestSchema, { prompt: '' })).toEqual({
      prompt: ['Too small: expected string to have >=1 characters'],
    });
    expect(errorsFor(generationRequestSchema, {})).toEqual({
      prompt: ['Invalid input: expected string, received undefined'],
    });
  });
});

describe('Personal info', () => {
  test('reports every invalid field', () => {
    expect(
      errorsFor(PersonalInfoSchema, {
        firstName: '',
        lastName: '',
        city: '',
        state: 'N',
        zipCode: '123',
        phone: '555-12',
        email: 'x',
      }),
    ).toEqual({
      firstName: ['First name is required'],
      lastName: ['Last name is required'],
      city: ['City is required'],
      state: ['State is required'],
      zipCode: ['Invalid ZIP code'],
      phone: ['Phone number must be 10 digits'],
      email: ['Invalid email address'],
    });
  });

  test('strips dashes from the phone number', () => {
    expect(
      dataFor(PersonalInfoSchema, {
        firstName: 'Ada',
        lastName: 'Lovelace',
        city: 'Austin',
        state: 'TX',
        zipCode: '12345',
        phone: '555-123-4567',
        email: 'ada@example.com',
      }),
    ).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      city: 'Austin',
      state: 'TX',
      zipCode: '12345',
      phone: '5551234567',
      email: 'ada@example.com',
    });
  });
});

test('Summary requires 50 characters', () => {
  expect(errorsFor(SummarySchema, { summary: 'short' })).toEqual({
    summary: ['Summary should be at least 50 characters'],
  });
});

describe('Experience', () => {
  const job = {
    jobId: 'job-1',
    jobTitle: 'Clerk',
    employer: 'Acme',
    city: 'Austin',
    state: 'TX',
  };

  test('reports every invalid field', () => {
    expect(
      errorsFor(BaseExperienceSchema, {
        jobId: '',
        jobTitle: '',
        employer: '',
        city: '',
        state: '',
        startDate: '',
        endDate: 'nope',
        currentlyEmployed: 'x',
      }),
    ).toEqual({
      jobId: ['Too small: expected string to have >=1 characters'],
      jobTitle: ['Job Title is required.'],
      employer: ['Employer is required.'],
      city: ['City is required.'],
      state: ['State is required.'],
      startDate: ['Start date is required.'],
      endDate: ['Invalid end date format'],
      currentlyEmployed: ['Invalid input: expected boolean, received string'],
    });
  });

  test('rejects a start date in the future', () => {
    expect(
      errorsFor(BaseExperienceSchema, {
        ...job,
        startDate: '2999-01',
        endDate: '',
      }),
    ).toEqual({ startDate: ['Start date cannot be in the future.'] });
  });

  test('parses dates and defaults currently employed', () => {
    expect(
      dataFor(BaseExperienceSchema, {
        ...job,
        startDate: '2020-01',
        details: ['Stocked shelves'],
      }),
    ).toEqual({
      ...job,
      startDate: new Date('2020-01-01T00:00:00.000Z'),
      endDate: undefined,
      currentlyEmployed: false,
      details: ['Stocked shelves'],
    });
  });
});

describe('Education', () => {
  test('reports every invalid field', () => {
    expect(
      errorsFor(BaseEducationSchema, {
        schoolName: '',
        educationLevel: 'Nope',
        graduationDate: '20',
      }),
    ).toEqual({
      schoolName: ['School Name is required.'],
      educationLevel: ['Invalid input'],
      graduationDate: [
        'Graduation Year must be a four-digit year.',
        'Graduation Year must be 1900 or later.',
      ],
    });
  });

  test('bounds the graduation year', () => {
    const entry = { schoolName: 'Austin High', educationLevel: 'GED' };
    expect(
      errorsFor(BaseEducationSchema, { ...entry, graduationDate: '1800' }),
    ).toEqual({ graduationDate: ['Graduation Year must be 1900 or later.'] });
    expect(
      errorsFor(BaseEducationSchema, { ...entry, graduationDate: '2100' }),
    ).toEqual({ graduationDate: ['Graduation Year must be 2099 or earlier.'] });
  });

  test('fills optional answers with their defaults', () => {
    expect(
      dataFor(BaseEducationSchema, {
        schoolName: 'UT Austin',
        educationLevel: 'PhD',
      }),
    ).toEqual({
      schoolName: 'UT Austin',
      educationLevel: 'PhD',
      degree: '',
      location: '',
      graduationDate: undefined,
      currentlyEnrolled: false,
    });
  });
});

test('Issue reports keep Zod default messages', () => {
  expect(
    errorsFor(userIssueReportSchema, {
      description: '  ',
      timestamp: 'x',
      url: 'nope',
    }),
  ).toEqual({
    description: ['Too small: expected string to have >=1 characters'],
    timestamp: ['Invalid ISO datetime'],
    url: ['Invalid URL'],
  });
});
