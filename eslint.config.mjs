import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config(
  {
    ignores: [
      'dist/**',
      'artifacts/**',
      'node_modules/**',
      'docs/screenshots/*.png',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['scripts/verify-extension.mjs'],
    languageOptions: {
      globals: {
        chrome: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        getSelection: 'readonly',
      },
    },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
);
