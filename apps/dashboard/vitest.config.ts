import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';

export default defineConfig({
  plugins: [react(), tsconfigPaths({ root: path.resolve(__dirname, '../..') })],
  resolve: {
    alias: {
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      '@tanstack/react-query': path.resolve(__dirname, 'node_modules/@tanstack/react-query'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['apps/dashboard/src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['apps/dashboard/src/__tests__/setup.ts'],
  },
});
