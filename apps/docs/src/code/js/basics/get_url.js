import { Sandbox } from '@e2b/sdk'

const sandbox = await Sandbox.create({id: 'base'})

const url = sandbox.getHostname() // $HighlightLine
console.log('https://' + url)

await sandbox.close()
