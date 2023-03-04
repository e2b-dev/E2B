const { fontFamily } = require('tailwindcss/defaultTheme')

module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx,css}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', ...fontFamily.sans],
        mono: ['var(--font-jet-brains)', ...fontFamily.mono],
      },
      height: { inherit: 'inherit' },
    },
  },
}
