// to be compatible with prettier.config.cjs
const prettierCompatRules = {
  quotes: ['error', 'single', { avoidEscape: true }],
  semi: ['error', 'never'],
  'max-len': [
    'error',
    {
      code: 90,
      ignoreComments: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
    },
  ],
}

module.exports = {
  env: {
    node: true,
    browser: true,
    es6: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier', // disables eslint rules that conflict with prettier
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.gen.ts'],
  plugins: ['@typescript-eslint', 'prettier', 'unused-imports'],
  rules: {
    ...prettierCompatRules,
    'prettier/prettier': ['error'],
    '@typescript-eslint/member-ordering': 'error',
    '@typescript-eslint/ban-ts-comment': 'off', // "move fast" mode
    '@typescript-eslint/no-explicit-any': 'off', // "move fast" mode
    'linebreak-style': ['error', 'unix'],
    'unused-imports/no-unused-imports': 'error',
    // 'unused-imports/no-unused-vars': [
    //   'warn',
    //   {
    //     args: 'none',
    //     argsIgnorePattern: '^_',
    //     vars: 'all',
    //     varsIgnorePattern: '^_',
    //   },
    // ],
  },
}
