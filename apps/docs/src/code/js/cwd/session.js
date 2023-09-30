import { Session } from '@e2b/sdk'

const session = await Session.create({
  id: 'Nodejs',
  apiKey: process.env.E2B_API_KEY,
  cwd: '/code', // $HighlightLine
})

// You can also change the cwd of an existing session
session.cwd = '/home' // $HighlightLine

await session.close()
