import { readBoundedText } from './boundedText.ts';
import { z } from './zod.ts';

export const ASSET_PATH =
  /^\/assets\/([A-Za-z][\w.-]{0,47})-([\w-]{8})\.(js|mjs|css)$/;

export const REPORT_ASSETS_FILE = 'report-assets.json';

export const NO_ASSETS: ReadonlySet<string> = new Set();

const REPORT_ASSETS_MAX = 2_000;
const REPORT_ASSETS_MAX_BYTES = 256 * 1024;

export const reportAssetsSchema = z
  .array(z.string().check(z.regex(ASSET_PATH)))
  .check(z.maxLength(REPORT_ASSETS_MAX));

export function reportAssetList(fileNames: Iterable<string>): string[] {
  return [...fileNames]
    .map((fileName) => `/${fileName}`)
    .filter((path) => ASSET_PATH.test(path))
    .sort();
}

export function withoutAssetHash(path: string): string {
  const match = ASSET_PATH.exec(path);
  if (!match) return path;
  const [, name, , extension] = match;
  return `/assets/${name}-[hash].${extension}`;
}

export type ReportAssetsFetch = (signal: AbortSignal) => Promise<Response>;

export const REPORT_ASSETS_TIMEOUT_MS = 5_000;

export function createKnownAssetsLoader(
  fetchAssets: ReportAssetsFetch | undefined,
  timeoutMs = REPORT_ASSETS_TIMEOUT_MS,
): () => Promise<ReadonlySet<string>> {
  let loaded: Promise<ReadonlySet<string>> | undefined;
  return () => {
    if (!fetchAssets) return Promise.resolve(NO_ASSETS);
    loaded ??= readWithin(fetchAssets, timeoutMs, (known) => {
      if (known === undefined) loaded = undefined;
    });
    return loaded;
  };
}

function readWithin(
  fetchAssets: ReportAssetsFetch,
  timeoutMs: number,
  settled: (known: ReadonlySet<string> | undefined) => void,
): Promise<ReadonlySet<string>> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(undefined);
    }, timeoutMs);
  });
  const read = readKnownAssets(fetchAssets, controller.signal).then((known) => {
    clearTimeout(timer);
    settled(known);
    return known;
  });
  return Promise.race([read, deadline]).then((known) => known ?? NO_ASSETS);
}

async function readKnownAssets(
  fetchAssets: ReportAssetsFetch,
  signal: AbortSignal,
): Promise<ReadonlySet<string> | undefined> {
  try {
    const response = await fetchAssets(signal);
    const type = response.headers.get('content-type') ?? '';
    if (signal.aborted || !response.ok || !type.includes('application/json')) {
      await response.body?.cancel();
      return undefined;
    }
    const { text, truncated } = await readBoundedText(
      response.body,
      REPORT_ASSETS_MAX_BYTES,
      signal,
    );
    if (truncated) return undefined;
    const parsed = reportAssetsSchema.safeParse(JSON.parse(text));
    return parsed.success ? new Set(parsed.data) : undefined;
  } catch {
    return undefined;
  }
}
