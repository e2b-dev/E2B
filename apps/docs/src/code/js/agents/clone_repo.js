import { Session } from '@e2b/sdk'

// 1. Start the playground session
const session = await Session.create({
  // 'Node', 'Bash', 'Python3', 'Java', 'Go', 'Rust', 'PHP', 'Perl', 'DotNET'
  id: 'Nodejs',
  apiKey: process.env.E2B_API_KEY,
})

// 2. Start a process that will clone a repository
let proc = await session.process.start({ // $HighlightLine
  cmd: 'git clone https://github.com/cruip/open-react-template.git /code/open-react-template', // $HighlightLine
  onStderr: data => console.log(data.line), // $HighlightLine
  onStdout: data => console.log(data.line), // $HighlightLine
}) // $HighlightLine
// 3. Wait for the process to finish
await proc.wait()

// Optional: 4. List the content of cloned repo
const content = await session.filesystem.list('/code/open-react-template')
console.log(content)

// Optional: 5. Install deps
console.log('Installing deps...')
proc = await session.process.start({
  cmd: 'npm install',
  cwd: '/code/open-react-template',
  onStdout: data => console.log(data.line),
  onStderr: data => console.log(data.line),
})
await proc.wait()

await session.close()
