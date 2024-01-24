const e2b = require('../dist')
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  const sandbox = await e2b.Sandbox.create({
    id: 'base',
    apiKey: process.env.E2B_API_KEY,
    __debug_hostname: 'localhost',
    __debug_port: 49982,
    __debug_devEnv: "local"
  })

  await sandbox.filesystem.write(
    '/code/hello.txt', "Hello World!"
  )
  const file = await sandbox.downloadFile('/code/hello.txt')

  const enc = new TextDecoder("utf-8");
  console.log(enc.decode(file))

  await sandbox.close()
}

main().catch(console.error)

