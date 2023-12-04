const e2b = require('../dist')
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  const sandbox = await e2b.Sandbox.create({
    id: 'base',
    apiKey: process.env.E2B_API_KEY
  })

  await sandbox.filesystem.write(
    '/code/hello.txt', "My friend!"
  )
  const files = await sandbox.filesystem.read('/code/hello.txt')
  console.log(files)

  await sandbox.close()
}

main().catch(console.error)

