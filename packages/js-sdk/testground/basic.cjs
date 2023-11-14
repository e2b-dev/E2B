const e2b = require('../dist')

async function main() {
  const sandbox = await e2b.Sandbox.create({
    id: 'base',
    apiKey: process.env.E2B_API_KEY
  })

  await sandbox.filesystem.write(
    '/code/package.json',
    JSON.stringify({
      dependencies: {
        'is-odd': '3.0.1'
      }
    })
  )

  const proc = await sandbox.process.start({
    cmd: 'npm i --silent',
    envVars: { NPM_CONFIG_UPDATE_NOTIFIER: 'false' },
    cwd: '/code',
    onStdout: ({ line }) => console.log('STDOUT', line),
    onStderr: ({ line }) => console.log('STDERR', line)
  })

  await proc.finished

  // list node_modules
  const files = await sandbox.filesystem.list('/code/node_modules')
  console.log(
    'installed node_modules (first 10 of them):',
    files
      .map(f => f.name)
      .slice(0, 10)
      .join(', ')
  )

  await sandbox.close()
}

main().catch(console.error)

