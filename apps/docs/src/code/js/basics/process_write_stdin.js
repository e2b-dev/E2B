import { Session } from '@e2b/sdk'

const session = await Session.create({
  id: 'Nodejs',
  apiKey: process.env.E2B_API_KEY,
})

// This example will print back the string we send to the process using `sendStdin()`

const proc = await session.process.start({
  cmd: 'while IFS= read -r line; do echo \"$line\"; sleep 1; done',
  onStdout: output => console.log(output),
})
await proc.sendStdin("AI Playground\n") // $HighlightLine
await proc.kill()

await session.close()
