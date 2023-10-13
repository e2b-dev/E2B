import { Session } from '@e2b/sdk'

const session = await Session.create({
  id: 'Nodejs',
  apiKey: process.env.E2B_API_KEY,
  onStdout: output => console.log('session', output.line), // $HighlightLine
})

const proc = await session.process.start({
  cmd: 'echo "Hello World!"',
})
await proc.wait()
// output: session Hello World!

const procWithCustomHandler = await session.process.start({
  cmd: 'echo "Hello World!"',
  onStdout: data => console.log('process', data.line), // $HighlightLine
})
await procWithCustomHandler.wait()
// output: process Hello World!

await session.close()
