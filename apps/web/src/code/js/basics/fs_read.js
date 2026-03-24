import { Sandbox } from 'e2b'

const sandbox = await Sandbox.create({ template: 'base' })

const fileContent = await sandbox.filesystem.read('/etc/hosts') // $HighlightLine
console.log(fileContent)

await sandbox.close()
