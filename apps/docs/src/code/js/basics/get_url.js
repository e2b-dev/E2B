import { Sandbox } from '@e2b/sdk'

const sandbox = await Sandbox.create({ template: 'base' })

const url = `https://${sandbox.getHostname()}` // $HighlightLine
console.log(url)

await sandbox.close()
