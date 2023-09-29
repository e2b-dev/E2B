import { Session } from '@e2b/sdk'

const session = await Session.create({
  id: 'Nodejs',
  apiKey: process.env.E2B_API_KEY,
  cwd: '/home/user/code', // $HighlightLine
})

await session.filesystem.write('hello.txt', 'Welcome to E2B!') // $HighlightLine
const proc = await session.process.start({ cmd: 'cat /home/user/code/hello.txt' })
await proc.finished
const out = proc.output.stdout
console.log(out)
// output: "Welcome to E2B!"

await session.filesystem.write('../hello.txt', 'We hope you have a great day!') // $HighlightLine
const proc2 = await session.process.start({ cmd: 'cat /home/user/hello.txt' })
await proc2.finished
console.log(proc2.output.stdout)
// output: "We hope you have a great day!"

await session.close()
