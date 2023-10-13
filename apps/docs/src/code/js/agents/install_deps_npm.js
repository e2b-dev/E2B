import { Session } from '@e2b/sdk'

// 1. Start the playground session
const session = await Session.create({
  // Note we're using the 'Nodejs' runtime here since we want to run Node.js code
  // and install NPM dependencies
  id: 'Nodejs', // $HighlightLine
  apiKey: process.env.E2B_API_KEY,
})

// 2. Install packages using NPM inside the /code directory
console.log('Installing lodash...')
const proc = await session.process.start({
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
await session.filesystem.write('/code/index.js', code)
// Run the code
console.log('Running code...')
const codeRun = await session.process.start({
  cmd: 'node /code/index.js',
  onStdout: (data) => console.log('[INFO] ', data.line),
  onStderr: (data) => console.log('[WARN | ERROR] ', data.line),
})
await codeRun.wait()

await session.close()
