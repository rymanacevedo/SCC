import {
  createKnownAssetsLoader,
  REPORT_ASSETS_FILE,
} from '../shared/reportAssets.ts';

/**
 * The asset paths the client build published, read from the page's own
 * origin the first time the page reports an error, then reused. A failed or
 * stalled read is the empty set, so every asset file is redacted, and the
 * next report tries again (see `createKnownAssetsLoader`).
 */
export const loadKnownAssets = createKnownAssetsLoader((signal) =>
  fetch(`/${REPORT_ASSETS_FILE}`, { signal }),
);
