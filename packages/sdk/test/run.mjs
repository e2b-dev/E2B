import { Session } from '../dist/cjs/index.js'

async function main() {
  const session = new Session({
    id: 'Nodejs',
    debug: true,
    retry: true,
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
    // __debug_port: 49982,
    // __debug_hostname: '127.0.0.1',
    // __debug_devEnv: 'local',
  })

  try {
    await session.open()

    const cmd = 'npm i'

    // await session.process.start({
    //   cmd,
    //   onStdout: o => console.log(o),
    // })

    const term = await session.terminal.createSession({
      onData: data => console.log(data),
      onExit: () => console.log('exit'),
      size: {
        cols: 9,
        rows: 9,
      },
      rootdir: '/code',
      cmd: 'npm i',
    })

    // term.sendData(`${cmd}\n`)

    // const dirWatchers = new Map()

    // const w2 = session.filesystem.watchDir('/code/dir')
    // dirWatchers.set('/code/dir', w2)
    // await w2.start()
    // w2.addEventListener(fsevent => {
    //   console.log('w2', fsevent)
    //   //if (fsevent.operation === FilesystemOperation.Remove) {
    //   //  // Remove and stop watcher for a dir that got removed.
    //   //  const dirwatcher = dirWatchers.get(fsevent.path)
    //   //  if (dirwatcher) {
    //   //    dirwatcher.stop()
    //   //    dirWatchers.delete(fsevent.path)
    //   //  }
    //   //}
    // })

    // const w3 = session.filesystem.watchDir('/code/dir/subdir')
    // dirWatchers.set('/code/dir/subdir', w3)
    // await w3.start()
    // w3.addEventListener(fsevent => {
    //   console.log('w3', fsevent)
    //   //if (fsevent.operation === FilesystemOperation.Remove && fsevent.path === '/code/dir/subdir') {
    //   //  w3.stop()
    //   //}
    // })
  } catch (e) {
    console.error('Session error', e)
  }
}

main()
