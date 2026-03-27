import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import swc from 'unplugin-swc';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    tsconfigPaths({ projects: [resolve(__dirname, 'tsconfig.base.json')] }),
    swc.vite({ tsconfigFile: resolve(__dirname, 'tsconfig.base.json') }),
  ],
  test: {
    globals: true,
    include: ['test/component/**/*.spec.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
