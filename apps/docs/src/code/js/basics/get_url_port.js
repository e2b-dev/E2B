import { Sandbox } from '@e2b/sdk'

const sandbox = await Sandbox.create({id: 'base'})

const openPort = 3000
const url = sandbox.getHostname(openPort) // $HighlightLine
console.log('https://' + url)

await sandbox.close()
