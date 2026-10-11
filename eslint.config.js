import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'reports', 'coverage', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx}'],
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
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG in engine/rng.ts.' },
      ],
    },
  },
);
