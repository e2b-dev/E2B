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
  const sandboxID = sandbox.id

  await sandbox.keepAlive(60)
  await sandbox.close()
  await wait(20000)

  const sandbox2 = await e2b.Sandbox.reconnect(sandboxID)

  const files = await sandbox2.filesystem.read('/code/hello.txt')
  console.log(
    files
  )

  await sandbox2.close()
}

main().catch(console.error)

