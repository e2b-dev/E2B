import { Session } from '@e2b/sdk'
import fs from 'node:fs'

const session = await Session.create({ id: 'Nodejs' })

const buffer = await session.downloadFile('path/to/remote/file/inside/sandbox') // $HighlightLine
// Save file to local filesystem
fs.writeFileSync('path/to/local/file', buffer)

await session.close()
