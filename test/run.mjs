import { Session } from '../dist/cjs/index.js'

async function main() {
  const session = new Session({
    id: '1k7EcyQxhviR',
    // codeSnippet: {
    //   onStateChange(state) {
    //     console.log(state)
    //   },
    //   onStderr(stderr) {
    //     console.log(stderr)
    //   },
    //   onStdout(stdout) {
    //     console.log(stdout)
    //   },
    // },
    debug: true,
    // editEnabled: true,
  })

  try {
    await session.open()

    // await session.codeSnippet?.run(String.raw`
    // const fs = require('fs')

    // try {
    //   const rest = fs.readFileSync('/test.fileg').toString()
    //   console.log('file', rest)
    // } catch (e) {
    //   console.error('no file')
    // }

    // fs.writeFileSync('/test.fileg', 'c;')
    // // try {
    // //     const rest = fs.readFileSync('/test.file').toString()
    // //   console.log('file', rest)
    // // } catch (e) {
    // //   console.error('no file')
    // // }
    // // // fs.writeFileSync('/test.file', '>>out')
    // // try {
    // //   const rest = fs.readFileSync('/test.file').toString()
    // //   console.log('file', rest)
    // // } catch (e) {
    // //   console.error('no file')
    // // }

    // // // setInterval(() => {
    // // //   try {
    // // //     const rest = fs.readFileSync('/test.file').toString()
    // // //     console.log('file', rest)
    // // //   } catch (e) {
    // // //     console.error('no file')
    // // //   }
    // // // }, 2000)

    // // `)
    // //     await session.codeSnippet.run(String.raw`
    // //     const http = require('http');

    // // const requestListener = function (req, res) {
    // //   res.writeHead(200);
    // //   res.end('Hello, World!');
    // // }

    // // const server = http.createServer(requestListener);
    // // server.listen(8080, () => {
    // //   console.log('Listening on 8080')
    // // });`)

    // const file = '/code/test.js'
    // const content = 'testing'
    // await session.filesystem.writeFile(file, content)
    // const fileContent = await session.filesystem.readFile(file)
    // console.log('file content', fileContent)

    // const fileNames = await session.filesystem.listAllFiles('/')
    // console.log('file names', fileNames)

    // const term = await session.terminal.createSession(
    //   (data) => console.log('terminal data', data),
    //   (cps) => console.log('child processes', cps),
    //   { rows: 40, cols: 90 },
    // )
    // console.log('terminalID', term.terminalID)
    // await term.sendData('sleep 10\n')

    await session.process.start({
      cmd: 'echo 4',
      onExit: () => {
        console.log('Exit')
      },
      onStdout: (o) => {
        console.log(o)
      },
      onStderr: (o) => {
        console.log(o)
      },
    })

  } catch (e) {
    console.error(e)
  }
}

main()
