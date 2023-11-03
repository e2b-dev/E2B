import { Sandbox } from '@e2b/sdk'
import fs from 'node:fs'

const sandbox = await Sandbox.create({id: 'base'})

const buffer = await sandbox.downloadFile('path/to/remote/file/inside/sandbox') // $HighlightLine
// Save file to local filesystem
fs.writeFileSync('path/to/local/file', buffer)

await sandbox.close()
