import { Session } from '@e2b/sdk'

const session = await Session.create({
  id: 'Nodejs',
  envVars: { FOO: 'Hello' }, // $HighlightLine
})

// This example will print back the string we send to the process using `sendStdin()`

const proc = await session.process.start({
  cmd: 'echo $FOO $BAR!',
  envVars: { BAR: 'World' }, // $HighlightLine
})
await proc.wait()
console.log(proc.output.stdout)
// output: Hello World!

await session.close()
