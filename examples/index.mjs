import { Session } from '../dist/cjs/index.js'

async function main() {
  const session = new Session({
    id: 'IUKVAOjElRCm',
    codeSnippet: {
      onStateChange(state) {
        console.log(state)
      },
      onStderr(stderr) {
        console.log(stderr)
      },
      onStdout(stdout) {
        console.log(stdout)
      },
    },
    debug: true,
    // editEnabled: true,
  })

  try {
    await session.open()

    await session.codeSnippet?.run(String.raw`
    const fs = require('fs')

    try {
      const rest = fs.readFileSync('/test.file').toString()
      console.log('file', rest)
    } catch (e) {
      console.error('no file')
    }

    fs.writeFileSync('/test.file', 'inline>>')

    setInterval(() => {
      try {
        const rest = fs.readFileSync('/test.file').toString()
        console.log('file', rest)
      } catch (e) {
        console.error('no file')
      }
    }, 2000)
        
    `)
    //     await session.codeSnippet.run(String.raw`
    //     const http = require('http');

    // const requestListener = function (req, res) {
    //   res.writeHead(200);
    //   res.end('Hello, World!');
    // }

    // const server = http.createServer(requestListener);
    // server.listen(8080, () => {
    //   console.log('Listening on 8080')
    // });`)

  } catch (e) {
    console.error(e)
  }
}

main()
