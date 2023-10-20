import { Session } from '@e2b/sdk'

// 1. Start the playground session
const session = await Session.create({
  // 'Node', 'Bash', 'Python3', 'Java', 'Go', 'Rust', 'PHP', 'Perl', 'DotNET'
  id: 'Nodejs',
  apiKey: process.env.E2B_API_KEY,
})

// 2. Start the shell commdand
let proc = await session.process.start({
  // $HighlightLine
  // Print names of all running processes
  cmd: "ps aux | tr -s ' ' | cut -d ' ' -f 11", // $HighlightLine
  // Stream stdout and stderr
  onStderr: data => console.log(data.line), // $HighlightLine
  onStdout: data => console.log(data.line), // $HighlightLine
}) // $HighlightLine

// 3. Wait for the process to finish
await proc.wait()

// 4. Or you can access output after the process has finished
const output = proc.output

await session.close()
