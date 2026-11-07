import {
  NO_ASSETS,
  REPORT_ASSETS_FILE,
  reportAssetsSchema,
} from '../../shared/reportAssets.ts';

/** The part of the `ASSETS` binding the loader uses. */
export type AssetsFetcher = { fetch(input: string): Promise<Response> };

// Any origin reaches the binding; the synthetic one names no real host.
const REPORT_ASSETS_URL = `https://app.invalid/${REPORT_ASSETS_FILE}`;

/**
 * The asset paths the client build published (`report-assets.json`), read
 * through the `ASSETS` binding on first use and reused for the isolate's
 * life. Anything but a JSON list of asset paths (no binding, a failed fetch,
 * a 404, the SPA fallback's `index.html`, invalid JSON, a list of the wrong
 * shape) is the empty set, so every asset file is redacted. A failure is not
 * reused: the next report tries again.
 */
export function createKnownAssetsLoader(
  assets: AssetsFetcher | undefined,
): () => Promise<ReadonlySet<string>> {
  let loaded: Promise<ReadonlySet<string>> | undefined;
  return () => {
    loaded ??= readKnownAssets(assets).then((known) => {
      if (known === undefined) loaded = undefined;
      return known ?? NO_ASSETS;
    });
    return loaded;
  };
}

async function readKnownAssets(
  assets: AssetsFetcher | undefined,
): Promise<ReadonlySet<string> | undefined> {
  if (!assets) return undefined;
  try {
    const response = await assets.fetch(REPORT_ASSETS_URL);
    const type = response.headers.get('content-type') ?? '';
    if (!response.ok || !type.includes('application/json')) {
      await response.body?.cancel();
      return undefined;
    }
    const parsed = reportAssetsSchema.safeParse(await response.json());
    return parsed.success ? new Set(parsed.data) : undefined;
  } catch {
    return undefined;
  }
}
