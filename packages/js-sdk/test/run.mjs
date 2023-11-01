import fs from 'fs'
import { runCode, Sandbox } from '../dist/index.js'

async function localSandbox() {
  return await Sandbox.create({
    id: 'Nodejs',
    apiKey: process.env.E2B_API_KEY
    // __debug_hostname: 'localhost',
    // __debug_port: 49982,
    // __debug_devEnv: 'local',
  })
}

async function main() {
  const sandbox = await localSandbox()

  const f = fs.readFileSync('./package.json')
  await sandbox.uploadFile(f, 'package.json')

  const content = await sandbox.filesystem.list('/home/user')
  content.forEach(c => console.log(c.name))
  process.exit()

  const response = await sandbox.downloadFile('/.dbkenv')
  const text = await response.text()
  console.log('text', text)
  process.exit()
  // const sandbox = await Sandbox.create({
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

    // await sandbox.filesystem.write('/code/file', 'test')
    // const content = await sandbox.filesystem.read('/code/file')
    // console.log('content', content)

    // const process = await sandbox.process.start({
    //   cmd: 'npm init -y',
    //   // onExit: () => console.log('exit'),
    //   // onStdout: data => console.log(data.line),
    // })
    // const cmd = 'npm i'

    // await sandbox.process.start({
    //   cmd,
    //   onStdout: o => console.log(o),
    // })

    // const term = await sandbox.terminal.start({
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

    // const w2 = sandbox.filesystem.watchDir('/code/dir')
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

    // const w3 = sandbox.filesystem.watchDir('/code/dir/subdir')
    // dirWatchers.set('/code/dir/subdir', w3)
    // await w3.start()
    // w3.addEventListener(fsevent => {
    //   console.log('w3', fsevent)
    //   //if (fsevent.operation === FilesystemOperation.Remove && fsevent.path === '/code/dir/subdir') {
    //   //  w3.stop()
    //   //}
    // })
  } catch (e) {
    console.error('Sandbox error', e)
  }
}

main()
