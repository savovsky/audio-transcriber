import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const currentDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      shared: resolve(currentDir, './shared/src/index.ts'),
      '@': resolve(currentDir, './client/src'),
    },
  },
  test: {
    include: ['shared/**/*.test.ts', 'server/**/*.test.ts', 'client/**/*.test.ts'],
    passWithNoTests: true,
  },
});
