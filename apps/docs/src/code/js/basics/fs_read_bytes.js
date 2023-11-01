import fs from 'fs'
import { Session } from '@e2b/sdk'

const session = await Session.create({ id: 'Nodejs' })

// File bytes will read file's content as bytes
// `fileBytes` as a Uint8Array
const fileBytes = await session.filesystem.readBytes('/etc/hosts') // $HighlightLine

// The output will look similar to this:
// <Buffer 31 32 37 2e 30 2e 30 2e 31 09 6c 6f 63 61 6c 68 6f 73  ...
console.log(fileBytes)

// We can save those bytes to a file locally like this:
fs.writeFileSync('hosts', fileBytes)

await session.close()
