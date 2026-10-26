const fs = require('node:fs')

const { releases } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
if (!Array.isArray(releases) || releases.length === 0) {
  throw new Error('Cannot publish without a release plan')
}

if (releases.length === 1 && releases[0].name === '@e2b/python-sdk') {
  console.log('pnpm run publish:python-sdk')
} else {
  const selected = new Set(releases.map(({ name }) => name))
  const python = fs.readdirSync('packages').flatMap((directory) => {
    const pkg = JSON.parse(
      fs.readFileSync(`packages/${directory}/package.json`, 'utf8')
    )
    return selected.has(pkg.name) && pkg.scripts?.postPublish ? [pkg.name] : []
  })
  const commands = ['pnpm --dir packages/js-sdk build']
  if (python.length) {
    const filters = python.map((name) => `--filter '${name}'`).join(' ')
    commands.push(`pnpm ${filters} -r run postPublish`)
  }
  commands.push('pnpm changeset publish')
  console.log(commands.join(' && '))
}
