import eslint from '@eslint/js';
import prettier from 'eslint-plugin-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Ported from openrebar's ESLint setup. Dropped: storybook + i18n plugins/rules
// (not used here) and no-magic-numbers (author decision — POC pipeline code is
// full of domain constants). Kept: typed rules, naming conventions, complexity
// and function-size limits, Prettier as a lint rule (options in .prettierrc.json).
const MAX_CYCLOMATIC_COMPLEXITY = 15;
const MAX_LINES_PER_FUNCTION = 115;
export default defineConfig([
  globalIgnores(['**/dist', 'data', '.gates', 'scripts']), // data = runtime storage; .gates = gate logs; scripts = dev tooling (typed rules need tsconfig membership)
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.{js,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        project: [
          './tsconfig.node.json',
          './shared/tsconfig.json',
          './server/tsconfig.json',
          './client/tsconfig.json',
          './client/tsconfig.node.json',
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      // Cast through unknown: eslint-plugin-react-hooks@7 (latest) ships a `configs.flat` type
      // that predates ESLint 10's Plugin['configs'] index signature — type-level only, runtime fine.
      'react-hooks': /** @type {import('eslint').ESLint.Plugin} */ (/** @type {unknown} */ (reactHooks)),
      prettier,
    },
    extends: [reactRefresh.configs.vite],
    settings: {
      react: {
        version: 'detect', // Automatically detect React version for linting rules that depend on it
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error', // Use 'unknown' + narrowing; escape via disable-comment with justification
      eqeqeq: ['error', 'always'], // No silent coercion
      'prefer-const': 'error',
      'max-statements-per-line': ['error', { max: 1 }],
      'no-nested-ternary': 'error', // Disallow nested ternary expressions for better readability
      'no-unneeded-ternary': 'error', // Disallow ternary operators when simpler alternatives exist
      'no-var': 'error', // Enforce let/const over var
      'block-spacing': ['error', 'always'],
      'operator-assignment': ['error', 'always'],
      'max-depth': ['error', 3], // Nested blocks
      complexity: ['error', MAX_CYCLOMATIC_COMPLEXITY], // Cyclomatic complexity
      'max-nested-callbacks': ['error', 2],
      'max-lines-per-function': ['error', MAX_LINES_PER_FUNCTION], // Keeps functions human-readable
      'max-params': ['error', 2], // For more, use an options object
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
      'no-else-return': 'error',
      'no-multiple-empty-lines': ['warn', { max: 1, maxEOF: 1 }],
      '@typescript-eslint/no-unused-vars': [
        // Enforce consistent handling of unused variables with exceptions for those prefixed with '_'
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'import',
          format: ['camelCase', 'PascalCase'], // Allow PascalCase for component imports
        },
        {
          selector: 'variable',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'], // PascalCase for components, UPPER_CASE for constants
        },
        {
          selector: 'parameter',
          format: ['camelCase'],
          leadingUnderscore: 'allow', // Allow leading underscore for unused parameters
        },
        {
          selector: 'function',
          format: ['camelCase', 'PascalCase'], // Allow PascalCase for React components
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
        {
          selector: 'typeParameter',
          format: ['PascalCase'],
          prefix: ['T', 'K', 'I'],
        },
        {
          selector: 'enumMember',
          format: ['UPPER_CASE'],
        },
        {
          selector: 'variable',
          types: ['boolean'],
          format: ['PascalCase'],
          prefix: ['can', 'did', 'has', 'is', 'must', 'needs', 'should', 'will'],
        },
      ],
      // Prettier formatting + import ordering, enforced as a lint rule; options: .prettierrc.json
      'prettier/prettier': 'error',
    },
  },
  // Tests: describe/it callbacks are declarative lists — function-length and
  // callback-nesting limits would only force artificial file splits
  {
    files: ['**/*.test.ts'],
    rules: {
      'max-lines-per-function': 'off',
      'max-nested-callbacks': 'off',
    },
  },
  // Plain JS files (this config): no type-aware linting
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
  // Stricter line limit for TypeScript files (utilities, types, etc.)
  {
    files: ['**/*.ts'],
    rules: {
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
    },
  },
  // Stricter line limit for TSX files (React components with JSX markup)
  {
    files: ['**/*.tsx'],
    rules: {
      'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
    },
  },
]);
