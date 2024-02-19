const e2b = require('../dist/index')

async function main() {
  const apiKey = '...'
  const lifetime = 60_000 * 5 // 5 minutes

  console.log('> Creating sandbox...')
  const sandboxID = await e2b.experimental_stateless.create({ apiKey }, {
    keepAliveFor: lifetime,
  })
  console.log('...sandbox created, sandbox id -', sandboxID)

  const cmd = 'echo hello world'
  console.log(`\n> Executing command "${cmd}"...`)
  await e2b.experimental_stateless.exec({
    apiKey,
    sandboxID
  }, {
    cmd,
    onStdout: (data) => {
      console.log(data)
    },
    onStderr: (data) => {
      console.error(data)
    },
  })
  console.log('...command finished')

  console.log('\n> Uploading file...')
  await e2b.experimental_stateless.uploadFile({
    apiKey,
    sandboxID,
  }, {
    path: '/tmp/hello.txt',
    content: new TextEncoder().encode('hello world'),
  })
  console.log('...file uploaded')

  console.log('\n> Downloading file...')
  const content = await e2b.experimental_stateless.downloadFile({
    apiKey,
    sandboxID,
  }, {
    path: '/tmp/hello.txt'
  })
  console.log('...downloaded file:\n', content.toString())

  console.log(`\n> Killing sandbox "${sandboxID}"...`)
  await e2b.experimental_stateless.kill({
    apiKey,
    sandboxID,
  })
  console.log('...sandbox killed')
}

main()
  .then(() => {
    console.log('\n\nFinished')
  })
