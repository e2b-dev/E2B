import { Sandbox } from 'e2b'

// 1. Start the playground sandbox
const sandbox = await Sandbox.create({
  // You can pass your own sandbox template id
  template: 'base',
  apiKey: process.env.E2B_API_KEY,
})

// 2. Start a process that will clone a repository
let proc = await sandbox.process.start({
  // $HighlightLine
  cmd: 'git clone https://github.com/cruip/open-react-template.git /code/open-react-template', // $HighlightLine
  onStderr: (data) => console.log(data.line), // $HighlightLine
  onStdout: (data) => console.log(data.line), // $HighlightLine
}) // $HighlightLine
// 3. Wait for the process to finish
await proc.wait()

// Optional: 4. List the content of cloned repo
const content = await sandbox.filesystem.list('/code/open-react-template')
console.log(content)

// Optional: 5. Install deps
console.log('Installing deps...')
proc = await sandbox.process.start({
  cmd: 'npm install',
  cwd: '/code/open-react-template',
  onStdout: (data) => console.log(data.line),
  onStderr: (data) => console.log(data.line),
})
await proc.wait()

await sandbox.close()
