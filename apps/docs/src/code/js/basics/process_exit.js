import { Session } from '@e2b/sdk'

const session = await Session.create({
  id: 'Nodejs',
  apiKey: process.env.E2B_API_KEY,
  onExit: () => console.log('[session]', 'process ended'), // $HighlightLine
})

const proc = await session.process.start({ cmd: 'echo "Hello World!"' })
await proc.wait()
// output: [session] process ended

const procWithCustomHandler = await session.process.start({
  cmd: 'echo "Hello World!"',
  onExit: () => console.log('[process]', 'process ended'), // $HighlightLine
})
await procWithCustomHandler.wait()
// output: [process] process ended

await session.close()
