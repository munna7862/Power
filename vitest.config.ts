import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/sim/**/*.ts'],
      exclude: ['src/sim/**/index.ts', 'src/sim/**/types.ts'],
      reporter: ['text-summary', 'html'],
      reportsDirectory: 'reports/coverage',
      thresholds: { lines: 85, functions: 85, statements: 85, branches: 80 },
    },
  },
});
