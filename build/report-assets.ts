import type { Plugin } from 'vite';
import { REPORT_ASSETS_FILE, reportAssetList } from '../shared/reportAssets.ts';

export function reportAssets(): Plugin {
  return {
    name: 'scc:report-assets',
    applyToEnvironment: (environment) => environment.name === 'client',
    generateBundle(_options, bundle) {
      this.emitFile({
        type: 'asset',
        fileName: REPORT_ASSETS_FILE,
        source: JSON.stringify(reportAssetList(Object.keys(bundle))),
      });
    },
  };
}
