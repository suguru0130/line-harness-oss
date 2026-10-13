import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  ssr: {
    // Native addon. The push tests load it from packages/db via createRequire.
    external: ['better-sqlite3'],
  },
  resolve: {
    alias: {
      // @line-crm/line-sdk has main=dist/index.js but dist may not exist in
      // the worktree; point Vitest directly at the TS sources so tests resolve
      // without a build step.
      '@line-crm/line-sdk': path.resolve(__dirname, '../../packages/line-sdk/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
