// Explicit Flow test: bun run build && bun test/education-flow.ts
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { info, summary } from './builder-fixtures.ts';

const server = Bun.serve({
  port: 0,
  async fetch(request) {
    const path = new URL(request.url).pathname;
    const asset = Bun.file(`dist/client${path}`);
    return new Response(
      path.startsWith('/assets/') && (await asset.exists())
        ? asset
        : Bun.file('dist/client/index.html'),
    );
  },
});
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    // Keep the browser demo offline, including third-party analytics.
    if (new URL(request.url()).hostname.endsWith('cloudflareinsights.com')) {
      void request.respond({
        status: 200,
        contentType: 'application/javascript',
        body: '',
      });
      return;
    }
    if (new URL(request.url()).pathname.startsWith('/api/'))
      void request.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          new URL(request.url()).pathname === '/api/summaries'
            ? [{ title: 'Stub summary', text: summary }]
            : { expertRecommended: ['Stub suggestion'], other: [] },
        ),
      });
    else void request.continue();
  });
  const base = `http://localhost:${server.port}`;
  await page.goto(base);
  async function waitPath(path: string) {
    await page.waitForFunction(
      (path) =>
        location.pathname === path &&
        !document.querySelector('form[aria-busy="true"]'),
      { timeout: 5000 },
      path,
    );
  }
  async function submit(path: string, button = 'nav button[type="submit"]') {
    await page.waitForSelector(button);
    await page.click(button);
    try {
      await waitPath(path);
    } catch (error) {
      console.error({
        expectedPath: path,
        actualUrl: page.url(),
        text: await page.$eval('body', (node) => node.textContent),
        errors,
      });
      throw error;
    }
  }
  async function type(name: string, value: string) {
    await page.waitForSelector(`[name="${name}"]`);
    await page.$eval(
      `[name="${name}"]`,
      (input, value) => {
        (input as HTMLInputElement).value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      },
      value,
    );
  }
  async function startSchool(name: string) {
    await page.goto(`${base}/education-level`);
    await submit(
      '/education',
      'button[name="educationLevel"][value="Certificate"]',
    );
    await type('schoolName', name);
  }
  await page.click('a[href="/info"]');
  await waitPath('/info');
  for (const [name, value] of Object.entries(info)) await type(name, value);
  await submit('/experience');
  for (const [name, value] of Object.entries({
    jobTitle: 'Developer',
    employer: 'Company',
    city: 'Boston',
    state: 'MA',
    startDate: '2020-01',
  }))
    await type(name, value);
  await page.click('[name="currentlyEmployed"]');
  await submit('/experience-entry');
  await type('details', 'Built reliable software');
  await submit('/experience-summary');
  await submit('/education-level');
  for (const [name, year] of [
    ['Old School', '2020'],
    ['New School', '2024'],
    ['Current School', '2026'],
  ]) {
    await startSchool(name!);
    if (name === 'Old School') {
      await page.reload();
      await page.waitForSelector('[name="schoolName"]');
      assert.equal(
        await page.$eval(
          '[name="schoolName"]',
          (input) => (input as HTMLInputElement).value,
        ),
        name,
      );
    }
    await submit('/education-entry');
    await type('graduationDate', year!);
    if (name === 'Current School')
      await page.click('[name="currentlyEnrolled"]');
    await submit('/education-summary');
  }
  assert.deepEqual(
    await page.$$eval('article h2', (nodes) =>
      nodes.map((node) => node.textContent),
    ),
    ['Current School', 'New School', 'Old School'],
  );
  await startSchool('Fourth');
  await page.click('nav button[type="submit"]');
  await page.waitForFunction(() =>
    document.body.textContent?.includes('You can add up to three schools.'),
  );
  await page.goto(`${base}/education-summary`);
  await page.click('article a');
  await waitPath('/education-level');
  // Revisit marks the saved level as current.
  await submit(
    '/education',
    'button[name="educationLevel"][aria-current="true"]',
  );
  await type('schoolName', 'Edited School');
  await submit('/education-entry');
  await page.click('[name="currentlyEnrolled"]');
  await type('graduationDate', '98');
  await page.click('nav button[type="submit"]');
  await page.waitForFunction(() =>
    document.body.textContent?.includes(
      'Graduation Year must be a four-digit year.',
    ),
  );
  await type('graduationDate', '2025');
  await submit('/education-summary');
  assert.equal(
    await page.$eval('article h2', (node) => node.textContent),
    'Edited School',
  );
  await page.click('article button');
  await page.waitForFunction(
    () => document.querySelectorAll('article').length === 2,
  );
  await submit('/skills');
  await page.waitForSelector('aside button');
  await page.click('aside button');
  await submit('/summary');
  await page.waitForSelector('aside button');
  await page.click('aside button');
  await submit('/finish-up');
  const stored = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('scc:user')!),
  );
  assert.equal(stored.user.education.length, 2);
  assert.deepEqual(Object.keys(stored.user).sort(), [
    'education',
    'experience',
    'info',
    'skills',
    'summary',
  ]);
  assert.equal(stored.user.skills.expertRecommended[0], 'Stub suggestion');
  assert.equal(stored.user.summary.summary, summary);
  await page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .find((button) => button.textContent === 'Start over')!
      .click(),
  );
  await page.waitForSelector('[name="confirm"]');
  assert.ok(await page.evaluate(() => sessionStorage.getItem('scc:user')));
  await page.click('[name="confirm"]');
  await waitPath('/');
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem('scc:user')),
    null,
  );
  assert.equal(stored.drafts.education, undefined);
  assert.deepEqual(errors, []);
  console.log(
    'PASS full builder Flow: home through finish-up, Suggestions, confirmed Start over; education: three schools, sorted Hub, cap, Revisit, inline year recovery, delete, reload Draft and Continue',
  );
} finally {
  await browser.close();
  server.stop(true);
}
