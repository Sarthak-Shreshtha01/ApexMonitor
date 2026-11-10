// Lint config for the server and the TypeScript SDKs (the web app has its own, apps/web/eslint.config.mjs).
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', 'apps/web/**', 'packages/python-sdk/**', '**/coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/server/**/*.ts', 'packages/sdk/**/*.ts', 'packages/browser-sdk/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      // Allowed with intent; prefer `unknown` in new code.
      '@typescript-eslint/no-explicit-any': 'off',
      // `declare global { namespace Express { ... } }` is how Express request types are extended.
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    files: ['**/*.mjs', '**/*.cjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Tests use fakes and dynamic imports freely.
    files: ['**/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
);
