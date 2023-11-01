import { Session } from '@e2b/sdk'

const session = await Session.create({
  id: 'Nodejs',
})

const dirContent = await session.filesystem.list('/') // $HighlightLine
dirContent.forEach(item => {
  console.log(item.name)
})

await session.close()
