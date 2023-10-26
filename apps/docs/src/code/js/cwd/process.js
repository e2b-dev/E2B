import { Session } from '@e2b/sdk'

const session = await Session.create({
  id: 'Nodejs',
  cwd: '/code', // $HighlightLine
})

const sessionCwd = await session.process.start({ cmd: 'pwd' }) // $HighlightLine
await sessionCwd.wait()
console.log(sessionCwd.output.stdout)
// output: /code

const processCwd = await session.process.start({ cmd: 'pwd', cwd: '/home' }) // $HighlightLine
await processCwd.wait()
console.log(processCwd.output.stdout)
// output: /home

await session.close()
