const { fontFamily } = require('tailwindcss/defaultTheme')

module.exports = {
  content: ['./components/**/*.{js,ts,jsx,tsx,css}', './pages/**/*.{js,ts,jsx,tsx,css}', './styles/**/*.{js,ts,jsx,tsx,css}'],
  darkMode: 'class',
  important: true,
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', ...fontFamily.sans],
      },
      spacing: {
        120: '30rem',
      },
      height: { inherit: 'inherit' },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
  ],
}
