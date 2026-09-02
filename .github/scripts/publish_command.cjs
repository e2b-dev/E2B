const fs = require('node:fs')

const { releases } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
if (!Array.isArray(releases) || releases.length === 0) {
  throw new Error('Cannot publish without a release plan')
}

console.log(
  releases.length === 1 && releases[0].name === '@e2b/python-sdk'
    ? 'pnpm run publish:python-sdk'
    : 'pnpm run publish'
)
