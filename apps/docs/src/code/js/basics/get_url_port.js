import { Sandbox } from '@e2b/sdk'

const sandbox = await Sandbox.create({ template: 'base' })

const openPort = 3000
const url = `https://${sandbox.getHostname(openPort)}` // $HighlightLine
console.log(url)

await sandbox.close()
