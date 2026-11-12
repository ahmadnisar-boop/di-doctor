import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const p = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@di-doctor/core': p('./packages/core/src/index.ts'),
      '@di-doctor/mcp': p('./packages/mcp/src/index.ts'),
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts'],
    testTimeout: 20000,
  },
});
