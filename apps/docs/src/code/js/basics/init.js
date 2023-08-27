import { Session } from '@e2b/sdk'

const session = await Session.create({
  id: 'Nodejs',
})
await session.close()
