import { Session } from '../dist/cjs/index.js'

async function main() {
  const session = new Session({
    id: 'Nodejs',
    debug: true,
    // codeSnippet: {
    //   onStateChange(state) {
    //     console.log(state)
    //   },
    //   onStdout(out) {
    //     console.log(out)
    //   },
    //   onStderr(err) {
    //     console.log(err)
    //   },
    // },
    onDisconnect() {
      console.log('disconnect')
    },
    onReconnect() {
      console.log('reconnect')
    },
    onClose() {
      console.log('close')
    },
    __debug_hostname: 'localhost',
    __debug_devEnv: 'local',
  })

  try {
    await session.open()
    // await session.codeSnippet.run('console')
    // await session.codeSnippet.run('echo 2')
    // await session.codeSnippet.stop()
    // await session.codeSnippet.run('sleep 2')
    // await session.codeSnippet.stop()
    const term = await session.terminal.createSession({
      onData: (data) => console.log(data),
      size: { cols: 20, rows: 40 },
      onChildProcessesChange: (cp) => console.log(cp),
    })

    // const term2 = await session.terminal.createSession({
    //   onData: (data) => console.log(data),
    //   size: { cols: 20, rows: 40 },
    // })


    // const p = await session.process.start({
    //   cmd: 'echo 22',
    //   onStdout: (o) => console.log(o.line)
    // })
    // await p.sendStdin('xx')
    // await term.sendData('sleep 2\n')
    // await p.kill()
    // await term2.destroy()

    // const files = await session.filesystem.listAllFiles('/')
    // console.log(files)
    // await session.filesystem.writeFile('/new', '>>--')
    // const content = await session.filesystem.readFile('/new')
    // console.log(content)
    // await session.filesystem.removeFile('/new')
    // const lastFiles = await session.filesystem.listAllFiles('/')
    // console.log(lastFiles)

    // const hostname = session.getHostname()
    // console.log(hostname)
  } catch (e) {
    console.error(e)
  }
}

main()
