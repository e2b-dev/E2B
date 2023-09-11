import { Session } from '@e2b/sdk'

const session = await Session.create({
  id: 'Nodejs',
  apiKey: process.env.E2B_API_KEY,
})

const fileContent = await session.filesystem.read('/etc/hosts') // $HighlightLine
console.log(fileContent)

await session.close()
