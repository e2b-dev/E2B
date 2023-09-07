const e2b = require("../dist/cjs/index")

async function main() {
  const session = await e2b.Session.create({
    id: 'Nodejs',
    apiKey: process.env.E2B_API_KEY
  })
  
  await session.filesystem.write(
    '/code/package.json',
    JSON.stringify({
      dependencies: {
        "is-odd": '3.0.1',
      },
    }),
  )
  
  const proc = await session.process.start({
    cmd: 'npm i --silent',
    envVars: { NPM_CONFIG_UPDATE_NOTIFIER: "false" },
    rootdir: '/code',
    onStdout: ({ line }) => console.log('STDOUT', line),
    onStderr: ({ line }) => console.log('STDERR', line),
  })
  
  await proc.finished
  
  // list node_modules
  const files = await session.filesystem.list('/code/node_modules')
  console.log(
    'installed node_modules (first 10 of them):',
    files
      .map(f => f.name)
      .slice(0, 10)
      .join(', '),
  )
  
  await session.close()
}

main().catch(console.error)

