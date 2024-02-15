module.exports = {
  env: {
    node: true,
    browser: true,
    es6: true,
  },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.gen.ts'],
  plugins: ['@typescript-eslint', 'unused-imports', '@stylistic/ts'],
  rules: {
    '@typescript-eslint/member-ordering': 'error',
    '@typescript-eslint/ban-ts-comment': 'off', // "move fast" mode
    '@typescript-eslint/no-explicit-any': 'off', // "move fast" mode
    'linebreak-style': ['error', 'unix'],
    'unused-imports/no-unused-imports': 'error',
    // No double quotes
    quotes: ['error', 'single', { avoidEscape: true }],
    // No extra semicolon
    '@stylistic/ts/semi': ['error', 'never'],
  },
}
