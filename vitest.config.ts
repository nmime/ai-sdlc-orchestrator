import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    testTimeout: 30_000,
    exclude: ['node_modules', 'dist', '.nx', 'tmp', 'coverage', 'apps/dashboard/**', '**/e2e-integration*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tmp/',
        '.nx/',
        'coverage/',
        '**/__tests__/**',
        '**/*.spec.ts',
        '**/*.test.ts',
        'apps/dashboard/**',
      ],
      thresholds: {
        lines: 50,
        branches: 40,
        functions: 50,
        statements: 50,
      },
    },
  },
});
