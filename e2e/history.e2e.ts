import { expect, test } from 'bun:test';
import { SUGGESTION_FAILURE_MESSAGES } from '../app/builder/suggestions.ts';
import { summaries } from './fixtures.ts';
import {
  openBrowser,
  seed,
  stored,
  submit,
  type,
  waitPath,
} from './support.ts';

test('Summary preserves soft navigation, accepted duplicate history, Back, Forward and Revisit', async () => {
  const { browser, page } = await openBrowser();
  try {
    await seed(page);
    await page.goto('http://localhost:5199/summary');
    await page.waitForSelector('[name="summary"]');
    await page.evaluate(() => {
      (window as unknown as { flowMarker: string }).flowMarker =
        'same-document';
    });
    await waitPath(page, '/summary');
    await page.waitForSelector('aside h3');
    expect(
      await page.$$eval('aside h3', (nodes) => nodes.map((n) => n.textContent)),
    ).toEqual(summaries.map((s: { title: string }) => s.title));
    const length = await page.evaluate(() => history.length);
    await type(page, 'summary', 'too short');
    await page.click('nav button[type="submit"]');
    await page.waitForFunction(() =>
      document.body.textContent?.includes('at least 50'),
    );
    expect(
      await page.$eval(
        '[name="summary"]',
        (input) => (input as HTMLTextAreaElement).value,
      ),
    ).toBe('too short');
    expect(new URL(page.url()).pathname).toBe('/summary');
    // Remix reads push before the 400 response; this duplicate is the accepted #197 tradeoff.
    expect(await page.evaluate(() => history.length)).toBe(length + 1);
    await page.waitForSelector('aside button');
    await page.click('aside button');
    await submit(page, '/finish-up');
    expect((await stored(page)).user.summary.summary).toBe(summaries[0].text);
    expect(
      await page.evaluate(
        () => (window as unknown as { flowMarker: string }).flowMarker,
      ),
    ).toBe('same-document');
    await page.goBack();
    await waitPath(page, '/summary');
    expect(
      await page.$eval(
        '[name="summary"]',
        (input) => (input as HTMLTextAreaElement).value,
      ),
    ).toBe(summaries[0].text);
    await page.goForward();
    await waitPath(page, '/finish-up');
    await page.click('a[href*="/summary?"]');
    await waitPath(page, '/summary');
    expect(
      await page.$eval(
        'nav button[type="submit"]',
        (button) => button.textContent,
      ),
    ).toBe('Resubmit');
    const edited =
      'Edited summary that is definitely longer than fifty characters in total length.';
    await type(page, 'summary', edited);
    await submit(page, '/finish-up');
    expect((await stored(page)).user.summary.summary).toBe(edited);
    await page.reload();
    await page.waitForSelector('a[href*="/summary?"]');
    expect((await stored(page)).user.summary.summary).toBe(edited);
  } finally {
    await browser.close();
  }
}, 60000);

test('geo 403 displays plain Suggestion unavailability and permits writing', async () => {
  const { browser, page } = await openBrowser();
  try {
    await seed(page);
    let rejected = false;
    const session = await page.createCDPSession();
    await session.send('Fetch.enable', {
      patterns: [{ urlPattern: '*/api/summaries', requestStage: 'Response' }],
    });
    session.on('Fetch.requestPaused', (event) => {
      rejected = true;
      void session.send('Fetch.fulfillRequest', {
        requestId: event.requestId,
        responseCode: 403,
        responseHeaders: [{ name: 'content-type', value: 'application/json' }],
        body: Buffer.from(
          JSON.stringify({ error: 'Country is not allowed' }),
        ).toString('base64'),
      });
    });
    await page.goto('http://localhost:5199/summary');
    await page.waitForFunction(
      (copy) => document.body.textContent?.includes(copy),
      {},
      SUGGESTION_FAILURE_MESSAGES.region,
    );
    expect(rejected).toBe(true);
    expect(await page.$eval('body', (body) => body.textContent)).not.toContain(
      'Country is not allowed',
    );
    await type(page, 'summary', summaries[0].text);
    await submit(page, '/finish-up');
  } finally {
    await browser.close();
  }
}, 60000);
