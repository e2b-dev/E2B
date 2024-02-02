import { Sandbox } from 'e2b'

const sandbox = await Sandbox.create({
  template: 'base',
})

const dirContent = await sandbox.filesystem.list('/') // $HighlightLine
dirContent.forEach((item) => {
  console.log(item.name)
})

await sandbox.close()
