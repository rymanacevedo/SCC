import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { reportAssets } from './build/report-assets.ts';

export default defineConfig({
  build: { manifest: true },
  plugins: [cloudflare(), tailwindcss(), reportAssets()],
  oxc: { jsx: { runtime: 'automatic', importSource: 'remix/component' } },
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
});
