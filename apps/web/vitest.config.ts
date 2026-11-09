import path from 'node:path';
import { defineConfig } from 'vitest/config';

/** Unit tests for framework-independent web logic (API client, state, routes). */
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname) } },
  test: {
    name: 'web',
    environment: 'node',
    include: ['test/**/*.test.ts'],
    env: { NEXT_PUBLIC_API_URL: 'http://api.test' },
  },
});
