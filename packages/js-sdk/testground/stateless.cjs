const { experimental_stateless } = require('../dist/index')
const {
  create,
  exec,
  kill,
  downloadFile,
} = experimental_stateless

async function main() {
  const apiKey = '...'
  const lifetime = 60_000 * 5 // 5 minutes

  console.log('> Creating sandbox...')
  const sandboxID = await create({ apiKey }, {
    keepAliveFor: lifetime,
  })
  console.log('...sandbox created, sandbox id -', sandboxID)

  const cmd = 'echo hello world'
  console.log(`\n> Executing command "${cmd}"...`)
  await exec({
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

  console.log('\n> Downloading file...')
  const content = await downloadFile({
    apiKey,
    sandboxID,
  }, {
    path: '/etc/hosts'
  })
  console.log('...downloaded file:\n', content.toString())

  console.log(`\n> Killing sandbox "${sandboxID}"...`)
  await kill({
    apiKey,
    sandboxID,
  })
  console.log('...sandbox killed')
}

main()
  .then(() => {
    console.log('\n\nFinished')
  })