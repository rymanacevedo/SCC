import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

test('production manifest keeps Export libraries and optional DOMPurify outside the initial Preview chunk', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const result = Bun.spawnSync(['bun', 'run', 'build'], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if (result.exitCode !== 0)
    throw new Error(result.stdout.toString() + result.stderr.toString());
  interface Chunk {
    file: string;
    isEntry?: boolean;
    isDynamicEntry?: boolean;
    imports?: string[];
    dynamicImports?: string[];
  }
  const manifest: Record<string, Chunk> = JSON.parse(
    readFileSync(`${root}dist/client/.vite/manifest.json`, 'utf8'),
  );
  const initial = new Set<string>();
  function visit(key: string) {
    if (initial.has(key)) return;
    initial.add(key);
    for (const dependency of manifest[key]?.imports ?? []) visit(dependency);
  }
  for (const [key, chunk] of Object.entries(manifest))
    if (chunk.isEntry) visit(key);
  for (const key of ['app/resume/pdf.ts', 'app/resume/docx.ts']) {
    expect(manifest[key]?.isDynamicEntry).toBe(true);
    expect(initial.has(key)).toBe(false);
    expect(
      [...initial].some((entry) =>
        manifest[entry]?.dynamicImports?.includes(key),
      ),
    ).toBe(true);
  }
  const purify = Object.keys(manifest).filter((key) =>
    key.includes('dompurify'),
  );
  expect(purify.length).toBeGreaterThan(0);
  for (const key of purify) expect(initial.has(key)).toBe(false);
  for (const key of initial)
    expect(key).not.toMatch(/(?:docx|jspdf|dompurify)/i);
  const pkg = JSON.parse(readFileSync(`${root}package.json`, 'utf8'));
  expect({ ...pkg.dependencies, ...pkg.devDependencies }).not.toHaveProperty(
    'dompurify',
  );
  for (const content of [
    JSON.stringify(pkg),
    readFileSync(`${root}bun.lock`, 'utf8'),
  ]) {
    expect(content).not.toMatch(/"(?:lexical|@lexical\/[^" ]+|file-saver)"/);
  }
}, 60_000);
