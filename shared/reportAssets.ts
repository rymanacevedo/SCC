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
 * The Worker reads it through its `ASSETS` binding (see ADR-0001): a
 * stack-frame file is kept only if it is on the list.
 */
export const REPORT_ASSETS_FILE = 'report-assets.json';

/** No published assets: every asset file in a frame is redacted. */
export const NO_ASSETS: ReadonlySet<string> = new Set();

// Far above any real build: the app ships a few dozen files.
const REPORT_ASSETS_MAX = 2_000;

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
