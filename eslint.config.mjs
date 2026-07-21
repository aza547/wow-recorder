import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginReact from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

/** @type {import('eslint').Linter.Config[]} */
export default [
  { files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'] },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  eslintPluginPrettierRecommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
    settings: { react: { version: 'detect' } },
    ignores: [
      'logs',
      '*.log',
      'pids',
      '*.pid',
      '*.seed',
      'coverage',
      '.eslintcache',
      'node_modules',
      '.DS_Store',
      'release/app/dist',
      'release/build',
      '.erb/dll',
      '.idea',
      'npm-debug.log.*',
      '*.css.d.ts',
      '*.sass.d.ts',
      '*.scss.d.ts',
      '!.erb',
    ],
  },
];
