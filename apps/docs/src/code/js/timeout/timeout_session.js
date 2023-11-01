import { Session } from '@e2b/sdk'

// Timeout 3s for the session to open
const session = await Session.create({
  id: 'Nodejs',
  timeout: 3000, // $HighlightLine
})

await session.close()
