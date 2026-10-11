import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import apex from './eslint-rules/index.js';

export default tseslint.config(
  { ignores: ['dist', 'dist-electron', 'release', 'reports', 'coverage', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx,cts}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ['src/**/*.tsx'],
    extends: [reactHooks.configs.flat.recommended],
    plugins: { 'react-refresh': reactRefresh },
    rules: { 'react-refresh/only-export-components': ['warn', { allowConstantExport: true }] },
  },
  {
    // i18n guard (Sprint 6.2): every word the player reads comes from src/ui/i18n.
    files: ['src/ui/**/*.{ts,tsx}'],
    ignores: ['src/ui/i18n/**'],
    plugins: { apex },
    rules: { 'apex/no-ui-literals': 'error' },
  },
  {
    // Architecture guard: the simulation must stay pure, portable and deterministic.
    files: ['src/sim/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react/*', 'zustand', 'zustand/*'],
              message: 'src/sim must not depend on UI libraries.',
            },
            {
              group: ['**/ui/**', '**/store/**', '**/platform/**'],
              message: 'src/sim must not import UI, store or platform code.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'No DOM access in src/sim.' },
        { name: 'document', message: 'No DOM access in src/sim.' },
        { name: 'localStorage', message: 'Persistence goes through src/platform.' },
        { name: 'Date', message: 'Use the game clock; wall-clock time breaks determinism.' },
        { name: 'performance', message: 'Wall-clock time breaks determinism.' },
        { name: 'Intl', message: 'Intl output depends on the host ICU data and breaks determinism.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG in engine/rng.ts.' },
        {
          property: 'toLocaleString',
          message: 'Locale formatting depends on the host ICU data; use groupIndian() from engine/numberFormat.ts.',
        },
        {
          property: 'localeCompare',
          message: 'Locale collation depends on the host ICU data; compare with < and > instead.',
        },
      ],
    },
  },
);
