// eslint-disable-next-line @typescript-eslint/no-var-requires
const root = require('../../prettier.config.cjs')

/** @type {import('prettier').Options} */
module.exports = {
  ...root,
  plugins: ['prettier-plugin-tailwindcss'],
}
