import { Session } from '@e2b/sdk'

const session = await Session.create({
  id: 'Nodejs',
  apiKey: process.env.E2B_API_KEY,
})

const npmInit = await session.process.start({ // $HighlightLine
  cmd: 'npm init -y'
})
await npmInit.wait()

console.log(npmInit.output.stdout)

await session.close()
