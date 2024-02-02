import { Sandbox } from 'e2b'

const sandbox = await Sandbox.create({
  template: 'base',
  cwd: '/home/user/code', // $HighlightLine
})

await sandbox.filesystem.write('hello.txt', 'Welcome to E2B!') // $HighlightLine
const proc = await sandbox.process.start({
  cmd: 'cat /home/user/code/hello.txt',
})
await proc.wait()
console.log(proc.output.stdout)
// output: "Welcome to E2B!"

await sandbox.filesystem.write('../hello.txt', 'We hope you have a great day!') // $HighlightLine
const proc2 = await sandbox.process.start({cmd: 'cat /home/user/hello.txt'})
await proc2.wait()
console.log(proc2.output.stdout)
// output: "We hope you have a great day!"

await sandbox.close()
