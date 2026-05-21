import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'tsconfig-paths';

export default defineConfig({
  test: {
    globals:     true,
    environment: 'node',
    setupFiles:  ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
});
