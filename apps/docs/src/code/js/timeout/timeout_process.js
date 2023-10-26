import { Session } from '@e2b/sdk'

const session = await Session.create({ id: 'Nodejs' })

// Timeout 3s for the process to start
const npmInit = await session.process.start({
  cmd: 'npm init -y',
  timeout: 3000, // $HighlightLine
})
await npmInit.wait()

await session.close()
