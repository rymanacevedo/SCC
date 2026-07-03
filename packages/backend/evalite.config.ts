import { defineConfig } from 'evalite/config';

export default defineConfig({
  setupFiles: ['./evals/setup.ts'],
  testTimeout: 60_000,
});
