import nextPlugin from '@next/eslint-plugin-next'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.expo/**',
      '**/coverage/**',
      'apps/mobile/**',
      'packages/plugin-template/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'react-hooks': reactHooks,
      '@next/next': nextPlugin,
    },
    rules: {
      'no-debugger': 'error',
    },
  },
  {
    files: [
      'packages/admin-client/**/*.ts',
      'packages/shared/src/credentials.ts',
      'packages/sdk/src/http.ts',
      'packages/sdk/src/client.ts',
      'packages/sdk/src/types.ts',
      'packages/sdk/tests/credentials.test.ts',
      'apps/web/src/lib/api.ts',
      'apps/web/src/lib/credential-store.ts',
      'apps/web/src/lib/api.wiring.test.ts',
    ],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
    },
  },
)
