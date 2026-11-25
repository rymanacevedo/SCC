import { afterEach } from 'bun:test';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const ROOT = join(import.meta.dirname, '..');

export const STUB_SECRETS = {
  GITHUB_TOKEN: 'ci-stub-token',
  OPENAI_API_KEY: 'ci-stub-openai-key',
};

export const WRANGLER_VARS = {
  ALLOWED_COUNTRIES: 'US',
  GITHUB_REPO: 'owner/repo',
};

interface ProjectFiles {
  vars?: Record<string, unknown>;
  devVars?: string;
}

interface Project {
  directory: string;
  environment: Record<string, string>;
}

export function useEnvironmentProjects(): (files?: ProjectFiles) => Project {
  const directories: string[] = [];

  function temporaryDirectory(): string {
    const directory = mkdtempSync(join(tmpdir(), 'scc-environment-'));
    directories.push(directory);
    return directory;
  }

  afterEach(() => {
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true });
    }
  });

  return ({ vars = WRANGLER_VARS, devVars } = {}) => {
    const directory = temporaryDirectory();
    cpSync(join(ROOT, '.env.schema'), join(directory, '.env.schema'));
    cpSync(join(ROOT, '.varlock'), join(directory, '.varlock'), {
      recursive: true,
    });
    writeFileSync(
      join(directory, 'wrangler.jsonc'),
      JSON.stringify({ name: 'scc-environment', vars }),
    );
    if (devVars !== undefined) {
      writeFileSync(join(directory, '.dev.vars'), devVars);
    }
    return {
      directory,
      environment: {
        PATH: process.env.PATH ?? '',
        HOME: temporaryDirectory(),
      },
    };
  };
}
