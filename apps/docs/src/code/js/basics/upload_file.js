import { Session } from '@e2b/sdk'
import fs from 'node:fs'

const session = await Session.create({ id: 'Nodejs' })


const fileName = 'data.csv'

// If you're in the server environment
const fileBuffer = fs.readFileSync('path/to/local/file') // $HighlightLine
const remotePath = await session.uploadFile(fileBuffer, fileName) // $HighlightLine

// If you're in the browser environment, you can use the Blob API
// const CSV = [
//   '"1","val1","val2","val3","val4"',
//   '"2","val1","val2","val3","val4"',
//   '"3","val1","val2","val3","val4"'
// ].join('\n');
// const fileBlob = new Blob([csv], { type: 'text/csv' })
// const remotePath = await session.uploadFile(fileBlob, 'data.csv')


console.log(`The file was uploaded to '${remotePath}' path inside the sandbox `)


await session.close()
