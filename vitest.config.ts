import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    exclude: ['**/node_modules/**', '**/dist/**', 'apps/dashboard/**', 'test/component/**', 'test/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['apps/*/src/**/*.ts', 'libs/*/src/**/*.ts', 'libs/feature/*/src/**/*.ts', 'libs/feature/agent/*/src/**/*.ts', 'libs/feature/agent/shared/*/src/**/*.ts'],
      exclude: [
        '**/*.spec.ts',
        '**/*.module.ts',
        '**/index.ts',
        '**/main.ts',
        '**/*.d.ts',
        '**/seed.ts',
        'apps/dashboard/**',
        '**/migrations/**',
        '**/app-error.ts',
        '**/shared-type/src/**',
        '**/ai-agent.port.ts',
        '**/sandbox.port.ts',
        '**/workflows/orchestrate-task.workflow.ts',
      ],
      thresholds: { branches: 80, functions: 80, lines: 80, statements: 80 },
    },
  },
});
