import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Browser, install } from '@puppeteer/browsers';
import pin from './browser.json' with { type: 'json' };

const children: ReturnType<typeof Bun.spawn>[] = [];
const varsPath = resolve('.dev.vars');
const previous = (await Bun.file(varsPath).exists())
  ? await readFile(varsPath)
  : undefined;
const directory = await mkdtemp(join(tmpdir(), 'scc-flow-'));
const env: Record<string, string | undefined> = {
  ...process.env,
  CLOUDFLARE_CF_FETCH_PATH: resolve('e2e/cf-us.json'),
};
async function run(command: string[], childEnv = env) {
  const child = Bun.spawn(command, {
    env: childEnv,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  children.push(child);
  const timeout = setTimeout(() => child.kill(), 120_000);
  const code = await child.exited;
  clearTimeout(timeout);
  if (code) throw new Error(`${command.join(' ')} exited ${code}`);
}
async function ready(url: string, child: ReturnType<typeof Bun.spawn>) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (child.exitCode !== null)
      throw new Error(`Server exited before ${url} was ready`);
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await Bun.sleep(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}
try {
  for (const url of ['http://localhost:5199', 'http://127.0.0.1:8788/health']) {
    let occupied = false;
    try {
      await fetch(url);
      occupied = true;
    } catch {}
    if (occupied) throw new Error(`Local port already in use: ${url}`);
  }
  await writeFile(
    varsPath,
    'OPENAI_API_KEY=flow-stub\nOPENAI_BASE_URL=http://127.0.0.1:8788/v1\nGITHUB_TOKEN=flow-stub\n',
  );
  await run(['bun', 'run', 'build']);
  const chrome = await install({
    browser: Browser.CHROME,
    buildId: pin.buildId,
    cacheDir: resolve('.cache/scc-chrome'),
  });
  const stub = Bun.spawn(['bun', 'e2e/openai-stub.ts'], {
    env: { ...env, PORT: '8788' },
    stdout: 'inherit',
    stderr: 'inherit',
  });
  children.push(stub);
  await ready('http://127.0.0.1:8788/health', stub);
  const preview = Bun.spawn(
    ['node', 'node_modules/vite/bin/vite.js', 'preview', '--port', '5199'],
    { env, stdout: 'inherit', stderr: 'inherit' },
  );
  children.push(preview);
  await ready('http://localhost:5199', preview);
  await run(['bun', 'test', './e2e/journey.e2e.ts', './e2e/history.e2e.ts'], {
    ...env,
    SCC_E2E_ORIGIN: 'http://localhost:5199',
    SCC_E2E_CHROME: chrome.executablePath,
    SCC_E2E_DOWNLOADS: directory,
  });
} finally {
  for (const child of children.reverse()) {
    if (child.exitCode === null) child.kill();
    await child.exited;
  }
  if (previous) await writeFile(varsPath, previous);
  else await rm(varsPath, { force: true });
  await rm(directory, { recursive: true, force: true });
}
