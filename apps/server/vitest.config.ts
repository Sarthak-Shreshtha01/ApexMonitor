import path from 'node:path';
import { defineConfig } from 'vitest/config';

const r = (p: string) => path.resolve(__dirname, p);

/** Shared path aliases (mirror tsconfig.json "paths"). */
export const serverAliases = {
  '@modules': r('src/modules'),
  '@shared': r('src/shared'),
  '@infrastructure': r('src/infrastructure'),
  '@workers': r('src/workers'),
  '@events': r('src/events'),
  '@config': r('src/config/config.ts'),
};

/** Unit tests: no external services; infrastructure is mocked. */
export default defineConfig({
  resolve: { alias: serverAliases },
  test: {
    name: 'server-unit',
    environment: 'node',
    include: ['test/unit/**/*.test.ts'],
    setupFiles: ['test/setup/unit-env.ts'],
    restoreMocks: true,
    clearMocks: true,
    testTimeout: 15_000,
    // `npm run test:coverage`: report only, no thresholds yet (see todo).
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/bootstrap.ts', 'src/migrate.ts'],
      reporter: ['text-summary', 'html', 'lcov'],
      reportsDirectory: 'coverage',
    },
  },
});
