import { Sandbox } from 'e2b'

// 1. Start the playground sandbox
const sandbox = await Sandbox.create({
  template: 'base', // $HighlightLine
  apiKey: process.env.E2B_API_KEY,
})

// 2. Install packages using NPM inside the /code directory
console.log('Installing lodash...')
const proc = await sandbox.process.start({
  cmd: 'npm install lodash', // $HighlightLine
  cwd: '/code', // $HighlightLine
  onStdout: (data) => console.log('[INFO] ', data.line),
  onStderr: (data) => console.log('[WARN | ERROR] ', data.line),
})
// Wait for the process to finish
await proc.wait()

// We can now use lodash in our code
const code = `
  const _ = require(
    'lodash');
  console.log(_.camelCase('Hello World'));
`
await sandbox.filesystem.write('/code/index.js', code)
// Run the code
console.log('Running code...')
const codeRun = await sandbox.process.start({
  cmd: 'node /code/index.js',
  onStdout: (data) => console.log('[INFO] ', data.line),
  onStderr: (data) => console.log('[WARN | ERROR] ', data.line),
})
await codeRun.wait()

await sandbox.close()
