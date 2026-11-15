// packages/ai-ui/eslint.config.js
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', '.example-dist/**', '.browser-artifacts/**', '.package-check/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat['recommended-latest'],
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true, argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly' },
    },
  },
  {
    // Callbacks passed to page.evaluate and waitForFunction run in the browser.
    files: ['scripts/browser.mjs', 'scripts/browser-general.mjs', 'scripts/browser-editor.mjs'],
    languageOptions: {
      globals: { document: 'readonly', window: 'readonly', navigator: 'readonly', CSSTransition: 'readonly', getComputedStyle: 'readonly', DataTransfer: 'readonly', ClipboardEvent: 'readonly', NodeFilter: 'readonly' },
    },
  },
);
