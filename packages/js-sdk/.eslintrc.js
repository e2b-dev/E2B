module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  ignorePatterns: ['src/api/schema.gen.ts', 'dist/**', 'node_modules/'],
  plugins: ['@typescript-eslint', 'prettier', 'unused-imports'],
  rules: {
    '@typescript-eslint/member-ordering': ['error'],
    'linebreak-style': ['error', 'unix'],
    'max-len': [
      'error',
      {
        code: 90,
        ignoreComments: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
      },
    ],
    'prettier/prettier': ['error'],
    quotes: ['error', 'single', { avoidEscape: true }],
    semi: ['error', 'never'],
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': [
      'warn',
      {
        args: 'none',
        argsIgnorePattern: '^_',
        vars: 'all',
        varsIgnorePattern: '^_',
      },
    ],
  },
}
