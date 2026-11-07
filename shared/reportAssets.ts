import { readBoundedText } from './boundedText.ts';
import { z } from './zod.ts';

/**
 * The app's own bundle files, as Vite names them: `/assets/<name>-<hash>.js`
 * with an 8-character base64url content hash (`/assets/entry.client-BUZPaea6.js`,
 * `/assets/education-BL-Djl3_.js`). The groups are the name, the hash and the
 * extension. The one shape shared by the build's published list, its
 * schema, stack-frame files and the fingerprint.
 */
export const ASSET_PATH =
  /^\/assets\/([A-Za-z][\w.-]{0,47})-([\w-]{8})\.(js|mjs|css)$/;

/**
 * The public file the client build publishes, listing its real asset paths.
 * The browser reads it from its own origin and the Worker through its
 * `ASSETS` binding (see ADR-0001): a stack-frame file is kept only if it is
 * on the list.
 */
export const REPORT_ASSETS_FILE = 'report-assets.json';

/** No published assets: every asset file in a frame is redacted. */
export const NO_ASSETS: ReadonlySet<string> = new Set();

// Far above any real build: the app ships a few dozen files.
const REPORT_ASSETS_MAX = 2_000;
// The most bytes a read takes: 2,000 paths of at most 70 characters, with
// room to spare. A longer body is not a list this build published.
const REPORT_ASSETS_MAX_BYTES = 256 * 1024;

/** The published list: asset paths only, and a bounded number of them. */
export const reportAssetsSchema = z
  .array(z.string().check(z.regex(ASSET_PATH)))
  .check(z.maxLength(REPORT_ASSETS_MAX));

/** The root-relative asset paths among a build's output file names, sorted. */
export function reportAssetList(fileNames: Iterable<string>): string[] {
  return [...fileNames]
    .map((fileName) => `/${fileName}`)
    .filter((path) => ASSET_PATH.test(path))
    .sort();
}

/**
 * An asset path with its content hash replaced (`/assets/main-[hash].js`),
 * so a new build of the same file reads the same; any other path as given.
 */
export function withoutAssetHash(path: string): string {
  const match = ASSET_PATH.exec(path);
  if (!match) return path;
  const [, name, , extension] = match;
  return `/assets/${name}-[hash].${extension}`;
}

/**
 * Fetches the published list (the browser's `fetch`, the Worker's binding),
 * aborting when `signal` does.
 */
export type ReportAssetsFetch = (signal: AbortSignal) => Promise<Response>;

/**
 * How long a read of the list may take, fetch and body together. Past it the
 * read is aborted (its body cancelled) and counts as failed, so no report
 * waits on a stalled read.
 */
export const REPORT_ASSETS_TIMEOUT_MS = 5_000;

/** One read of the list, and the deadline it is held to. */
type Attempt = {
  read: Promise<ReadonlySet<string> | undefined>;
  deadline: Promise<undefined>;
};

/**
 * The asset paths the client build published (`report-assets.json`), read
 * on first use and reused after. Anything but a JSON list of asset paths (no
 * fetcher, a failed fetch, a 404, the SPA fallback's `index.html`, invalid
 * JSON, a body past its byte cap, a list of the wrong shape, a read past
 * `timeoutMs`) is the empty set, so every asset file is redacted. A failure
 * is not reused: the next report tries again. At most one read runs at a
 * time: while a read the deadline cut off has not yet ended, a report gets
 * the empty set at once rather than starting another.
 */
export function createKnownAssetsLoader(
  fetchAssets: ReportAssetsFetch | undefined,
  timeoutMs = REPORT_ASSETS_TIMEOUT_MS,
): () => Promise<ReadonlySet<string>> {
  let known: ReadonlySet<string> | undefined;
  let attempt: Attempt | undefined;
  return async () => {
    if (known) return known;
    if (!fetchAssets) return NO_ASSETS;
    attempt ??= startAttempt(fetchAssets, timeoutMs, (result) => {
      known = result;
      attempt = undefined;
    });
    return (await Promise.race([attempt.read, attempt.deadline])) ?? NO_ASSETS;
  };
}

/**
 * Starts one read under its own deadline, which aborts the read's signal.
 * `settled` runs once the read itself ends, success or not.
 */
function startAttempt(
  fetchAssets: ReportAssetsFetch,
  timeoutMs: number,
  settled: (result: ReadonlySet<string> | undefined) => void,
): Attempt {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(undefined);
    }, timeoutMs);
  });
  const read = readKnownAssets(fetchAssets, controller.signal).then(
    (result) => {
      clearTimeout(timer);
      settled(result);
      return result;
    },
  );
  return { read, deadline };
}

/** The list, or undefined for any failure; never rejects. */
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
    // Cancelled on abort, so a body that never ends cannot outlive the
    // deadline.
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
