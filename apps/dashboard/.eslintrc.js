module.exports = {
  extends: ['next'],
  ignorePatterns: ['db/supabase.ts'],
  rules: {
    '@next/next/no-html-link-for-pages': 'off',
    'react/jsx-key': 'off',
  },
  plugins: ['unused-imports', 'tailwindcss'],
  rules: {
    'tailwindcss/enforces-negative-arbitrary-values': 'warn',
    'tailwindcss/enforces-shorthand': 'warn',
    'tailwindcss/migration-from-tailwind-2': 'warn',
    'tailwindcss/no-arbitrary-value': 'off',
    'tailwindcss/no-custom-classname': ['error', {
      'whitelist': ['instructions-editor']
    }],
    'tailwindcss/no-contradicting-classname': 'error',
    'unused-imports/no-unused-imports': 'error',
    'react/jsx-sort-props': [
      2,
      {
        shorthandFirst: false,
        shorthandLast: true,
        ignoreCase: true,
        noSortAlphabetically: true,
      },
    ],
    'react-hooks/exhaustive-deps': ['warn'],
    semi: ['error', 'never'],
    quotes: [
      'error',
      'single',
      {
        avoidEscape: true,
      },
    ],
  },
}