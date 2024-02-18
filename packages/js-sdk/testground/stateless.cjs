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

  const sandboxID = await create({ apiKey }, {
    keepAliveFor: lifetime,
  })

  exec({
    apiKey,
    sandboxID
  }, {
    cmd: 'echo hello',
    onStdout: (data) => {
      console.log(data)
    },
    onStderr: (data) => {
      console.error(data)
    },
  })
    .then(() => {
      console.log('Kill sandbox...')
      return kill({
        apiKey,
        sandboxID,
      })
    })
    .then(() => {
      console.log('...killed')
    })

  const content = await downloadFile({
    apiKey,
    sandboxID,
  }, {
    path: '/etc/hosts'
  })
  console.log('downloaded file', content)
  console.log('downloaded file content as string:', content.toString())
}

main()
  .then(() => {
    console.log('done')
  })