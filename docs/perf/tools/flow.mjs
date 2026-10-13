// Lighthouse user flow: seeded /summary (AI mocked or live) and /resume typing timespan.
// Usage: CHROME_PATH=... node flow.mjs --origin=https://host --out=/dir --formFactor=mobile|desktop --ai=mock|live
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import puppeteer from 'puppeteer';
import {desktopConfig, startFlow} from 'lighthouse';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const {origin, out} = args;
const formFactor = args.formFactor ?? 'mobile';
const ai = args.ai ?? 'mock';
if (!origin || !out) throw new Error('--origin and --out are required');
mkdirSync(out, {recursive: true});
const user = JSON.parse(readFileSync(new URL('./user-fixture.json', import.meta.url), 'utf8'));
const summaries = JSON.parse(readFileSync(new URL('./summaries-fixture.json', import.meta.url), 'utf8'));

const browser = await puppeteer.launch({executablePath: process.env.CHROME_PATH, headless: true});
const page = await browser.newPage();
if (ai === 'mock') {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.method() === 'POST' && /\/api\/summaries$/.test(new URL(req.url()).pathname)) {
      req.respond({status: 200, contentType: 'application/json',
        headers: {'access-control-allow-origin': origin}, body: JSON.stringify(summaries)});
    } else {
      req.continue();
    }
  });
}
// sessionStorage is per tab; seed it in the tab Lighthouse will drive.
await page.goto(`${origin}/`, {waitUntil: 'networkidle0'});
await page.evaluate((u) => sessionStorage.setItem('user', JSON.stringify(u)), user);

const flow = await startFlow(page, {
  name: `seeded ${formFactor} (ai=${ai})`,
  config: formFactor === 'desktop' ? desktopConfig : undefined,
});
await flow.navigate(`${origin}/summary`, {name: `/summary seeded, ai=${ai}`});
await page.waitForSelector('h3', {timeout: 60_000}); // example summary cards rendered
await flow.navigate(`${origin}/resume`, {name: '/resume seeded (warm: storage not reset)'});
await page.waitForSelector('[contenteditable="true"]', {timeout: 30_000});
await flow.startTimespan({name: '/resume typing in Lexical editor'});
await page.click('[contenteditable="true"]');
await page.keyboard.type('Performance typing sample for INP and TBT. ', {delay: 20});
await flow.endTimespan();

writeFileSync(`${out}/flow-${formFactor}-${ai}.report.html`, await flow.generateReport());
writeFileSync(`${out}/flow-${formFactor}-${ai}.json`, JSON.stringify(await flow.createFlowResult(), null, 2));
await browser.close();
