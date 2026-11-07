import { expect, test } from 'bun:test';
import { reportAssetsSchema } from '../shared/reportAssets.ts';
import { reportAssets } from './report-assets.ts';

type GenerateBundle = (
  this: { emitFile: (file: unknown) => string },
  options: unknown,
  bundle: Record<string, unknown>,
) => void;

test('the plugin publishes the client bundle asset paths as report-assets.json', () => {
  const plugin = reportAssets();
  const applies = plugin.applyToEnvironment as (env: { name: string }) => boolean;
  expect(applies({ name: 'client' })).toBe(true);
  expect(applies({ name: 'scc' })).toBe(false);
  const emitted: unknown[] = [];
  (plugin.generateBundle as GenerateBundle).call(
    { emitFile: (file) => String(emitted.push(file)) },
    {},
    {
      'assets/index-BOZHR0Lk.js': {},
      'assets/index-BhuUxWMn.css': {},
      'assets/docx-D0gTG6qN.js': {},
      'assets/inter-latin-400-normal-Ab12Cd34.woff2': {},
      'index.html': {},
      '.vite/manifest.json': {},
    },
  );
  expect(emitted).toHaveLength(1);
  const [file] = emitted as { type: string; fileName: string; source: string }[];
  expect(file?.type).toBe('asset');
  expect(file?.fileName).toBe('report-assets.json');
  const list = JSON.parse(file?.source ?? '[]');
  expect(list).toEqual([
    '/assets/docx-D0gTG6qN.js',
    '/assets/index-BOZHR0Lk.js',
    '/assets/index-BhuUxWMn.css',
  ]);
  // What the plugin publishes is what the Worker accepts.
  expect(reportAssetsSchema.safeParse(list).success).toBe(true);
});
