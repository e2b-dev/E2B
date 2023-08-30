import { Session } from '@e2b/sdk'

const session = await Session.create({
  id: 'Nodejs',
  apiKey: process.env.E2B_API_KEY,
})

const dirContent = await session.filesystem.list('/')
dirContent.forEach((item) => {
  console.log(item.name)
})

await session.close()
