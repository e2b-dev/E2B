const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const run = (command, args) => execFileSync(command, args, { stdio: 'inherit' })

const { releases } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
if (!Array.isArray(releases) || releases.length === 0) {
  throw new Error('Cannot publish without a release plan')
}

if (releases.length === 1 && releases[0].name === '@e2b/python-sdk') {
  run('sh', [path.join(__dirname, 'publish_python_sdk.sh')])
} else {
  const selected = new Set(releases.map(({ name }) => name))
  const python = fs.readdirSync('packages').flatMap((directory) => {
    const pkg = JSON.parse(
      fs.readFileSync(`packages/${directory}/package.json`, 'utf8')
    )
    return selected.has(pkg.name) && pkg.scripts?.postPublish ? [pkg.name] : []
  })
  run('pnpm', ['--dir', 'packages/js-sdk', 'build'])
  if (python.length) {
    const filters = python.flatMap((name) => ['--filter', name])
    run('pnpm', [...filters, '-r', 'run', 'postPublish'])
  }
  run('pnpm', ['changeset', 'publish'])
}
