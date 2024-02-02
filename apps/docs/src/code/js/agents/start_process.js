import { Sandbox } from 'e2b'

// 1. Start the playground sandbox
const sandbox = await Sandbox.create({
  // You can pass your own sandbox template id
  template: 'base',
  apiKey: process.env.E2B_API_KEY,
})

// 2. Start the shell commdand
let proc = await sandbox.process.start({
  // $HighlightLine
  // Print names of all running processes
  cmd: 'ps aux | tr -s \' \' | cut -d \' \' -f 11', // $HighlightLine
  // Stream stdout and stderr
  onStderr: (data) => console.log(data.line), // $HighlightLine
  onStdout: (data) => console.log(data.line), // $HighlightLine
}) // $HighlightLine

// 3. Wait for the process to finish
await proc.wait()

// 4. Or you can access output after the process has finished
const output = proc.output

await sandbox.close()
