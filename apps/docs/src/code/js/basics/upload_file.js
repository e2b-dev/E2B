import { Sandbox } from 'e2b'
import fs from 'node:fs'

const sandbox = await Sandbox.create({ template: 'base' })

// If you're in the server environment
const filename = 'data.csv' // $HighlightLine
const fileBuffer = fs.readFileSync('path/to/local/file') // $HighlightLine
const remotePath = await sandbox.uploadFile(fileBuffer, filename) // $HighlightLine

// If you're in the browser environment, you can use the Blob API
// const filename = 'data.csv'
// const CSV = [
//   '"1","val1","val2","val3","val4"',
//   '"2","val1","val2","val3","val4"',
//   '"3","val1","val2","val3","val4"'
// ].join('\n');
// const fileBlob = new Blob([csv], { type: 'text/csv' })
// const remotePath = await sandbox.uploadFile(fileBlob, 'data.csv')

console.log(
  `The file was uploaded to '${remotePath}' path inside the sandbox `,
)

await sandbox.close()
