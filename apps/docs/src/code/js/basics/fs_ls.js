import { Sandbox } from '@e2b/sdk'

const sandbox = await Sandbox.create({
  id: 'base',
})

const dirContent = await sandbox.filesystem.list('/') // $HighlightLine
dirContent.forEach((item) => {
  console.log(item.name)
})

await sandbox.close()
