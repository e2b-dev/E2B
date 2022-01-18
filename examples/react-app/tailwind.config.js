module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  important: true,
  theme: {
    extend: {
      height: {
        inherit: 'inherit',
        'calc-100': 'calc(100%)',
      },
      width: {
        inherit: 'inherit',
        column: '720px',
      },
      minWidth: {
        editor: '580px',
      },
      fontSize: {
        '2xs': '0.75rem',
        xs: '0.8125rem',
      },
    },
    fontFamily: {
      sans: [
        'ui-sans-serif',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Helvetica',
        '"Apple Color Emoji"',
        'Arial',
        'sans-serif',
        '"Segoe UI Emoji"',
        '"Segoe UI Symbol"',
      ],
      mono: [
        'ui-monospace',
        'SFMono-Regular',
        'Menlo',
        'Monaco',
        'Consolas',
        '"Liberation Mono"',
        '"Courier New"',
        'monospace',
      ]
    },
    colors: {
      transparent: 'transparent',
      black: {
        900: '#141414',
        800: '#1F1F1F',
        700: '#262626',
        650: '#292929',
        600: '#363636',
      },
      gray: {
        800: '#8F8F8F',
        700: '#B1B1B1',
        600: '#BBBBBB',
        550: '#CBCBCB',
        500: '#D1D1D1',
        400: '#DBDBDB',
        300: '#DEDEDE',
        200: '#E9E9E9',
        100: '#F0F0F0',
      },
      denim: {
        800: '#373D47',
        700: '#3C4A5D',
        400: '#6A7380',
        300: '#6F7885',
        200: '#898F99',
        100: '#AEAFB2',
      },
      caviar: {
        800: '#292B2E',
      },
      green: {
        400: '#0AC069',
      },
      red: {
        400: '#FC4F60',
      },
      purple: {
        400: '#553AC0',
      },
    },
  },
  variants: {
    scrollbar: ['dark'],
    extend: {
      backgroundColor: ['active', 'disabled'],
      opacity: ['disabled'],
      cursor: ['disabled'],
    },
  },
  plugins: [
    require('tailwind-scrollbar'),
  ],
}
