import type { Plugin } from 'vite';
import { REPORT_ASSETS_FILE, reportAssetList } from '../shared/reportAssets.ts';

/**
 * Publishes the client build's asset paths as `report-assets.json`, a public
 * static file of file names only. The browser reads it from its own origin
 * and the Worker through its `ASSETS` binding, to keep a stack-frame file
 * only if the app ships it. The Worker cannot import the list at build time:
 * the Cloudflare plugin builds the Worker environments before the client.
 */
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
