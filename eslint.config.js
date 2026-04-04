import globals from 'globals';

export default [
  {
    ignores: ['docs/**', 'dist/**', 'node_modules/**'],
  },
  {
    files: ['app.js', 'src/modules/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
];
