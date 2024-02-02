import { Sandbox } from 'e2b'

const sandbox = await Sandbox.create({
  template: 'base',
  onExit: () => console.log('[sandbox]', 'process ended'), // $HighlightLine
})

const proc = await sandbox.process.start({cmd: 'echo "Hello World!"'})
await proc.wait()
// output: [sandbox] process ended

const procWithCustomHandler = await sandbox.process.start({
  cmd: 'echo "Hello World!"',
  onExit: () => console.log('[process]', 'process ended'), // $HighlightLine
})
await procWithCustomHandler.wait()
// output: [process] process ended

await sandbox.close()
