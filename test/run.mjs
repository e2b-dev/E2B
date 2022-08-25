import { promisify } from 'util'
import { Session } from '../dist/cjs/index.js'

const wait = promisify(setTimeout)

async function main() {
  const session = new Session({
    // id: 'xYBy4D9Gi5GM',
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
    __debug_url: 'localhost:8010/ws',
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

    const terminal = await session.terminal.createSession({
      onData: (data) => console.log('Terminal', data),
      onChildProcessesChange: (cps) => console.log('child processes', cps),
      size: { rows: 40, cols: 90 },
    })


    const languageServer = await session.process.start({
      cmd: 'lsp-ws-proxy -l 9999 -- typescript-language-server --stdio',
      onExit: () => {
        console.log('Exit')
      },
      onStdout: (o) => {
        console.log('Language server', o.line)
      },
      onStderr: (o) => {
        console.error('Language server', o.line)
      },
    })

    // prisma studio --browser none
    const prismaStudio = await session.process.start({
      cmd: 'npx prisma studio',
      onExit: () => {
        console.log('Exit')
      },
      onStdout: (o) => {
        console.log('Prisma studio', o.line)
      },
      onStderr: (o) => {
        console.error('Prisma studio', o.line)
      },
    })

    terminal.sendData('ls')

    await new Promise()
  } catch (e) {
    console.error(e)
  }
}

main()
