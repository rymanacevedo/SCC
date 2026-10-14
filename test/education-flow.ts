// Explicit Flow test: bun run build && bun test/education-flow.ts
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { experience, info } from './builder-fixtures.ts';

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
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/'))
      void request.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          expertRecommended: ['Stub suggestion'],
          other: [],
        }),
      });
    else void request.continue();
  });
  const base = `http://localhost:${server.port}`;
  await page.goto(base);
  await page.evaluate(
    (user) =>
      sessionStorage.setItem(
        'scc:user',
        JSON.stringify({
          version: 1,
          timestamp: new Date().toISOString(),
          user,
          drafts: {},
        }),
      ),
    { info, experience },
  );
  async function waitPath(path: string) {
    await page.waitForFunction(
      (path) =>
        location.pathname === path &&
        !document.querySelector('form[aria-busy="true"]'),
      { timeout: 5000 },
      path,
    );
  }
  async function submit(path: string) {
    await page.click('nav button[type="submit"]');
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
    await page.waitForSelector('select');
    await page.select('select', 'Certificate');
    await submit('/education');
    await type('schoolName', name);
  }
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
  await submit('/education');
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
  const stored = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('scc:user')!),
  );
  assert.equal(stored.user.education.length, 2);
  assert.equal(stored.drafts.education, undefined);
  assert.deepEqual(errors, []);
  console.log(
    'PASS education Flow: three schools, sorted Hub, cap, Revisit, inline year recovery, delete, reload Draft and Continue',
  );
} finally {
  await browser.close();
  server.stop(true);
}
