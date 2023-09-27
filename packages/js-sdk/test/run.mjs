import { runCode } from '../dist/cjs/index.js'

async function main() {
  // const session = await Session.create({
  //   id: 'Nodejs',
  //   apiKey: process.env.E2B_API_KEY,
  // })

  try {
    // const code = 'console.log("Hello World"); console.error("Bum")'
    const code = `
print("hello")
raise Exception("err")
`
    const out = await runCode('Python3', code)
    console.log(out)
    // console.log('stdout', stdout)
    // console.log('stderr', stderr)

    // await session.filesystem.write('/code/file', 'test')
    // const content = await session.filesystem.read('/code/file')
    // console.log('content', content)

    // const process = await session.process.start({
    //   cmd: 'npm init -y',
    //   // onExit: () => console.log('exit'),
    //   // onStdout: data => console.log(data.line),
    // })
    // const cmd = 'npm i'

    // await session.process.start({
    //   cmd,
    //   onStdout: o => console.log(o),
    // })

    // const term = await session.terminal.createSession({
    //   onData: data => console.log(data),
    //   onExit: () => console.log('exit'),
    //   size: {
    //     cols: 9,
    //     rows: 9,
    //   },
    //   cwd: '/code',
    //   cmd: 'npm i',
    // })

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
