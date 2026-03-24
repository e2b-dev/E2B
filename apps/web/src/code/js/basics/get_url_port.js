import { Sandbox } from 'e2b'

const sandbox = await Sandbox.create({ template: 'base' })

const openPort = 3000
const url = sandbox.getHostname(openPort) // $HighlightLine
console.log('https://' + url)

await sandbox.close()
