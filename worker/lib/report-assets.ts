import {
  createKnownAssetsLoader,
  REPORT_ASSETS_FILE,
} from '../../shared/reportAssets.ts';

/** The part of the `ASSETS` binding the loader uses. */
type AssetsFetcher = { fetch(input: string): Promise<Response> };

// Any origin reaches the binding; the synthetic one names no real host.
const REPORT_ASSETS_URL = `https://app.invalid/${REPORT_ASSETS_FILE}`;

function isAssetsFetcher(value: unknown): value is AssetsFetcher {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { fetch?: unknown }).fetch === 'function'
  );
}

/**
 * The published asset paths, read through the `ASSETS` binding on first use
 * and reused for the isolate's life (see `createKnownAssetsLoader`). No
 * binding, or one without `fetch`, is the empty set.
 */
export function createWorkerKnownAssetsLoader(
  env: object,
): () => Promise<ReadonlySet<string>> {
  const assets = 'ASSETS' in env ? env.ASSETS : undefined;
  return createKnownAssetsLoader(
    isAssetsFetcher(assets) ? () => assets.fetch(REPORT_ASSETS_URL) : undefined,
  );
}
