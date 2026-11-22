import {
  createKnownAssetsLoader,
  REPORT_ASSETS_FILE,
} from '../shared/reportAssets.ts';

export const loadKnownAssets = createKnownAssetsLoader((signal) =>
  fetch(`/${REPORT_ASSETS_FILE}`, { signal }),
);
