import { readFileSync } from 'node:fs';
export const summaries = JSON.parse(
  readFileSync(new URL('./summaries-fixture.json', import.meta.url), 'utf8'),
);
export const user = JSON.parse(
  readFileSync(new URL('./user-fixture.json', import.meta.url), 'utf8'),
);
export function summaryResponse() {
  return JSON.stringify(summaries);
}
export function seededEnvelope() {
  return {
    version: 1,
    timestamp: new Date().toISOString(),
    drafts: {},
    user: {
      ...user,
      info: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        city: 'Boston',
        state: 'MA',
        zipCode: '02110',
        email: 'ada@example.com',
      },
      education: [],
      skills: { expertRecommended: ['TypeScript'], other: [] },
      summary: { summary: summaries[0].text },
    },
  };
}
