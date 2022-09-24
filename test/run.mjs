import { Session } from '../dist/cjs/index.js'

async function main() {
  const session = new Session({
    id: 'Nodejs',
    debug: true,
    // codeSnippet: {
    //   onStateChange(state) {
    //     console.log(state)
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
    console.log('connected')

    // const term = await session.terminal.createSession({
    //   onData: (data) => console.log(data),
    //   size: { cols: 20, rows: 40 },
    // })

    // const term2 = await session.terminal.createSession({
    //   onData: (data) => console.log(data),
    //   size: { cols: 20, rows: 40 },
    // })

    await session.process.start({
      cmd: 'echo 22',
      onStdout: (o) => console.log(o.line)
    })

    // await term.destroy()
    const hostname = session.getHostname()
    console.log(hostname)
  } catch (e) {
    console.error(e)
  }
}

main()
