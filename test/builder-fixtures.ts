import type { User } from '../app/user.ts';
export const info = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  city: 'Boston',
  state: 'MA',
  zipCode: '02110',
  email: 'ada@example.com',
  phone: '1234567890',
};
export const experience = [
  {
    jobId: 'job-1',
    jobTitle: 'Developer',
    employer: 'Company',
    city: 'Boston',
    state: 'MA',
    startDate: '2020-01-01T00:00:00.000Z',
    currentlyEmployed: true,
    details: ['Built reliable software'],
  },
];
export const summary =
  'Experienced developer building reliable software and helping teams deliver useful products.';
export const summaryUser: User = {
  info,
  experience,
  education: [{ educationId: 'school-1', schoolName: 'College' }],
  skills: { expertRecommended: ['TypeScript'], other: [] },
};
export function builderRequest(path: string, values?: Record<string, string>) {
  return new Request(
    `https://scc.example${path}`,
    values ? { method: 'POST', body: new URLSearchParams(values) } : undefined,
  );
}
