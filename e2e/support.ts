import puppeteer, { type Page } from 'puppeteer';
import { seededEnvelope } from './fixtures.ts';
export async function openBrowser() {
  if (
    process.env.SCC_E2E_ORIGIN !== 'http://localhost:5199' ||
    !process.env.SCC_E2E_CHROME
  )
    throw new Error('Flow tests must run through bun run test:e2e');
  const browser = await puppeteer.launch({
    executablePath: process.env.SCC_E2E_CHROME,
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  // Local-only Flow tests: third-party beacon is covered by the dev-run Gate.
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      url.origin === process.env.SCC_E2E_ORIGIN ||
      url.protocol === 'blob:' ||
      url.protocol === 'data:'
    )
      void request.continue();
    else
      void request.respond({
        status: 200,
        contentType: 'application/javascript',
        body: '',
      });
  });
  await page.goto(process.env.SCC_E2E_ORIGIN);
  return { browser, page };
}
export async function seed(page: Page) {
  await page.evaluate(
    (envelope) => sessionStorage.setItem('scc:user', JSON.stringify(envelope)),
    seededEnvelope(),
  );
}
export async function waitPath(page: Page, path: string) {
  await page.waitForFunction(
    (path) =>
      location.pathname === path &&
      !document.querySelector('form[aria-busy="true"]'),
    { timeout: 15000 },
    path,
  );
}
export async function submit(
  page: Page,
  path: string,
  button = 'nav button[type="submit"]',
) {
  await page.waitForSelector(button);
  await page.click(button);
  await waitPath(page, path);
}
/** The education level page submits through one button per level. */
export const levelButton = (level: string) =>
  `button[name="educationLevel"][value="${level}"]`;
export async function type(page: Page, name: string, value: string) {
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
export async function stored(page: Page) {
  return page.evaluate(() => JSON.parse(sessionStorage.getItem('scc:user')!));
}
