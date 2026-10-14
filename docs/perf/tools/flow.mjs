// Lighthouse user flow: seeded /summary and /resume Preview with Revisit typing.
// Usage: CHROME_PATH=... node flow.mjs --origin=https://host --out=/dir --formFactor=mobile|desktop --ai=mock|live
import {mkdirSync, writeFileSync} from 'node:fs';
import puppeteer from 'puppeteer';
import { seededEnvelope } from '../../../e2e/fixtures.ts';
import { summaryResponse } from '../../../e2e/openai-stub.ts';
import { readFileSync } from 'node:fs';
import { computeExecutablePath, Browser } from '@puppeteer/browsers';
const pin = JSON.parse(readFileSync(new URL('../../../e2e/browser.json', import.meta.url), 'utf8'));
import {desktopConfig, startFlow} from 'lighthouse';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const {origin, out} = args;
const formFactor = args.formFactor ?? 'mobile';
const ai = args.ai ?? 'mock';
if (!origin || !out) throw new Error('--origin and --out are required');
mkdirSync(out, {recursive: true});
const browser = await puppeteer.launch({executablePath: process.env.CHROME_PATH ?? computeExecutablePath({ browser: Browser.CHROME, buildId: pin.buildId, cacheDir: '.cache/scc-chrome' }), headless: true});
const page = await browser.newPage();
if (ai === 'mock') {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.method() === 'POST' && /\/api\/summaries$/.test(new URL(req.url()).pathname)) {
      req.respond({status: 200, contentType: 'application/json',
        headers: {'access-control-allow-origin': origin}, body: summaryResponse()});
    } else {
      req.continue();
    }
  });
}
// sessionStorage is per tab; seed it in the tab Lighthouse will drive.
await page.goto(`${origin}/`, {waitUntil: 'networkidle0'});
await page.evaluate((u) => sessionStorage.setItem('scc:user', JSON.stringify(u)), seededEnvelope());

const flow = await startFlow(page, {
  name: `seeded ${formFactor} (ai=${ai})`,
  config: formFactor === 'desktop' ? desktopConfig : undefined,
});
await flow.navigate(`${origin}/summary`, {name: `/summary seeded, ai=${ai}`});
await page.waitForSelector('h3', {timeout: 60_000}); // example summary cards rendered
await flow.navigate(`${origin}/resume`, {name: '/resume seeded (warm: storage not reset)'});
await page.waitForSelector('a[href="/summary"]');
await flow.startTimespan({name: '/resume Preview Revisit interaction'});
await page.click('a[href="/summary"]');
await page.waitForSelector('[name="summary"]');
await page.type('[name="summary"]', 'Performance typing sample for INP and TBT. ', {delay: 20});
await flow.endTimespan();

writeFileSync(`${out}/flow-${formFactor}-${ai}.report.html`, await flow.generateReport());
writeFileSync(`${out}/flow-${formFactor}-${ai}.json`, JSON.stringify(await flow.createFlowResult(), null, 2));
await browser.close();
