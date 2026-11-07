import {
  createKnownAssetsLoader,
  REPORT_ASSETS_FILE,
} from '../shared/reportAssets.ts';

// A read that takes longer than this is treated as failed: the report is
// still sent, with every asset file redacted.
const REPORT_ASSETS_TIMEOUT_MS = 5_000;

/**
 * The asset paths the client build published, read from the page's own
 * origin the first time the page reports an error, then reused. A failed
 * read is the empty set, so every asset file is redacted, and the next
 * report tries again (see `createKnownAssetsLoader`).
 */
export const loadKnownAssets = createKnownAssetsLoader(() =>
  fetch(`/${REPORT_ASSETS_FILE}`, {
    signal: AbortSignal.timeout(REPORT_ASSETS_TIMEOUT_MS),
  }),
);
