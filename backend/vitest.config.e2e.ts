import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    // Suites share one database and assert aggregate totals; isolate their fixtures.
    // Individual tests still exercise concurrent confirmations and payments.
    fileParallelism: false,
    setupFiles: ['./test/audit-isolation.ts'],
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});
