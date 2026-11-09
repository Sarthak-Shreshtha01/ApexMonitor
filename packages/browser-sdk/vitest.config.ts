import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'browser-sdk',
    environment: 'node',
    include: ['test/**/*.test.ts'],
    restoreMocks: true,
  },
});
