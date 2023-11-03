import { Sandbox } from '@e2b/sdk'

const sandbox = await Sandbox.create({
  id: 'base',
  cwd: '/code', // $HighlightLine
})

const sandboxCwd = await sandbox.process.start({cmd: 'pwd'}) // $HighlightLine
await sandboxCwd.wait()
console.log(sandboxCwd.output.stdout)
// output: /code

const processCwd = await sandbox.process.start({cmd: 'pwd', cwd: '/home'}) // $HighlightLine
await processCwd.wait()
console.log(processCwd.output.stdout)
// output: /home

await sandbox.close()
