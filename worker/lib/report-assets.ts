import {
  createKnownAssetsLoader,
  REPORT_ASSETS_FILE,
} from '../../shared/reportAssets.ts';
import { REPORT_ORIGIN } from '../../shared/telemetryRedaction.ts';

type AssetsFetcher = {
  fetch(input: string, init: { signal: AbortSignal }): Promise<Response>;
};

const REPORT_ASSETS_URL = `${REPORT_ORIGIN}/${REPORT_ASSETS_FILE}`;

function isAssetsFetcher(value: unknown): value is AssetsFetcher {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { fetch?: unknown }).fetch === 'function'
  );
}

export function createWorkerKnownAssetsLoader(
  env: object,
): () => Promise<ReadonlySet<string>> {
  const assets = 'ASSETS' in env ? env.ASSETS : undefined;
  return createKnownAssetsLoader(
    isAssetsFetcher(assets)
      ? (signal) => assets.fetch(REPORT_ASSETS_URL, { signal })
      : undefined,
  );
}
