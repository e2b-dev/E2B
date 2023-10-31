import { Session } from '@e2b/sdk'

const session = await Session.create({
  id: 'Nodejs',
  envVars: { FOO: 'Hello' }, // $HighlightLine
})

await session.close()
