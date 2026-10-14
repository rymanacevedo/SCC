// Explicit offline browser demo: bun test/reporting-flow.ts
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { ERROR_MODAL_MESSAGE } from '../app/error-reporting.ts';

const bundle = await Bun.build({
  entrypoints: ['test/reporting-demo.tsx'],
  target: 'browser',
});
if (!bundle.success) throw new Error(bundle.logs.join('\n'));
const reports: { path: string; body: Record<string, unknown> }[] = [];
const server = Bun.serve({
  port: 0,
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/demo.js')
      return new Response(bundle.outputs[0], {
        headers: { 'Content-Type': 'application/javascript' },
      });
    if (path.startsWith('/api/')) {
      reports.push({
        path,
        body: (await request.json()) as Record<string, unknown>,
      });
      // Stub both GitHub reporting endpoints; no external requests.
      return Response.json({ ok: true });
    }
    return new Response(
      '<!doctype html><html><head></head><body><script type="module" src="/demo.js"></script></body></html>',
      {
        headers: { 'Content-Type': 'text/html' },
      },
    );
  },
});
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage();
  const base = `http://localhost:${server.port}`;
  for (const path of ['/throw', '/throw-component']) {
    const reported = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/errors',
    );
    await page.goto(`${base}${path}`);
    await reported;
    await page.waitForFunction(
      (copy) => document.body.textContent?.includes(copy),
      {},
      ERROR_MODAL_MESSAGE,
    );
    await page.waitForFunction(() =>
      Boolean(document.querySelector('footer button')),
    );
    assert.equal(
      reports.filter((report) => report.path === '/api/errors').length,
      path === '/throw' ? 1 : 2,
    );
  }
  // The error page's primary Report an issue opens its own dialog.
  await page.click('main section button');
  const dialog = 'main section dialog';
  assert.equal(await page.$eval(dialog, (node) => node.open), true);
  await page.type(`${dialog} textarea`, 'The demo page threw an error');
  await page.click(`${dialog} button[type="submit"]`);
  await page.waitForFunction(() =>
    document
      .querySelector('[role="status"]')
      ?.textContent?.includes('Your issue has been reported'),
  );
  const issue = reports.find((report) => report.path === '/api/report-issue');
  assert.ok(issue);
  assert.equal(issue.body.description, 'The demo page threw an error');
  assert.equal(issue.body.url, `${base}/throw-component`);
  assert.deepEqual(Object.keys(issue.body).sort(), [
    'description',
    'timestamp',
    'url',
  ]);
  await page.click(`${dialog} button[type="button"]`);
  assert.equal(await page.$eval(dialog, (node) => node.open), false);
  await page.goto(`${base}/unknown`);
  await page.waitForFunction(() =>
    document.body.textContent?.includes('Page not found'),
  );
  assert.equal(
    reports.filter((report) => report.path === '/api/errors').length,
    2,
  );
  console.log(
    'Reporting browser demo passed: controller and component errors, modal submission, and 404.',
  );
} finally {
  await browser.close();
  server.stop(true);
}
