import { expect, test } from 'bun:test';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { info } from '../test/builder-fixtures.ts';
import { openBrowser, stored, submit, type, waitPath } from './support.ts';

test('User walks every Step, persists answers and creates both Exports', async () => {
  const { browser, page } = await openBrowser();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  try {
    await page.click('a[href="/info"]');
    await waitPath(page, '/info');
    for (const [name, value] of Object.entries(info))
      await type(page, name, value);
    await submit(page, '/experience');
    expect((await stored(page)).user.info).toEqual(info);
    for (const [name, value] of Object.entries({
      jobTitle: 'Developer',
      employer: 'Company',
      city: 'Boston',
      state: 'MA',
      startDate: '2020-01-01',
    }))
      await type(page, name, value);
    await page.click('[name="currentlyEmployed"]');
    await submit(page, '/experience-entry');
    expect((await stored(page)).drafts.experience.employer).toBe('Company');
    await type(page, 'details', 'Built reliable software');
    await submit(page, '/experience-summary');
    expect((await stored(page)).user.experience[0].details).toEqual([
      'Built reliable software',
    ]);
    await submit(page, '/education-level');
    await page.select('select', 'Certificate');
    await submit(page, '/education');
    expect((await stored(page)).drafts.education.educationLevel).toBe(
      'Certificate',
    );
    await type(page, 'schoolName', 'College');
    await submit(page, '/education-entry');
    expect((await stored(page)).drafts.education.schoolName).toBe('College');
    await type(page, 'graduationDate', '2024');
    await submit(page, '/education-summary');
    expect((await stored(page)).user.education[0].graduationDate).toBe('2024');
    await submit(page, '/skills');
    await page.waitForSelector('aside button');
    await page.click('aside button');
    await submit(page, '/summary');
    expect((await stored(page)).user.skills.expertRecommended).toEqual([
      'TypeScript',
    ]);
    await page.waitForSelector('aside button');
    await page.click('aside button');
    const picked = await page.$eval(
      '[name="summary"]',
      (input) => (input as HTMLTextAreaElement).value,
    );
    await submit(page, '/finish-up');
    expect((await stored(page)).user.summary.summary).toBe(picked);
    expect((await stored(page)).drafts).toEqual({});
    await submit(page, '/resume');
    await page.waitForFunction(() =>
      document.body.textContent?.includes('Preview'),
    );
    const session = await page.createCDPSession();
    await session.send('Browser.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: process.env.SCC_E2E_DOWNLOADS!,
    });
    for (const format of ['PDF', 'DOCX']) {
      await page.waitForFunction(
        (format) =>
          [...document.querySelectorAll('button')].some(
            (b) => b.textContent === `Export ${format}` && !b.disabled,
          ),
        {},
        format,
      );
      await page.evaluate(
        (format) =>
          [...document.querySelectorAll('button')]
            .find((b) => b.textContent === `Export ${format}`)!
            .click(),
        format,
      );
      const extension = `.${format.toLowerCase()}`;
      let found = false;
      for (let attempt = 0; attempt < 150; attempt++) {
        const files = await readdir(process.env.SCC_E2E_DOWNLOADS!);
        const file = files.find((file) => file.endsWith(extension));
        if (
          file &&
          (await stat(join(process.env.SCC_E2E_DOWNLOADS!, file))).size > 0
        ) {
          found = true;
          break;
        }
        await Bun.sleep(100);
      }
      expect(found).toBe(true);
    }
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
}, 90000);
