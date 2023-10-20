import { Session } from '@e2b/sdk'

// 1. Start the playground session
const session = await Session.create({
  // Select the right runtime
  // 'Node', 'Bash', 'Python3', 'Java', 'Go', 'Rust', 'PHP', 'Perl', 'DotNET'
  id: 'Nodejs',
  apiKey: process.env.E2B_API_KEY,
})

// 2. Save the JavaScript code to a file inside the playground
const code = `
  const fs = require('fs');
  const dirContent = fs.readdirSync('/');
  dirContent.forEach((item) => {
    console.log('Root dir item inside playground:', item);
  });
`
await session.filesystem.write('/code/index.js', code)

// 3. Start the execution of the JavaScript file we saved
const proc = await session.process.start({
  // $HighlightLine
  cmd: 'node /code/index.js', // $HighlightLine
  // 4. Stream stdout, stderr
  onStdout: data => console.log(data.line), // $HighlightLine
  onStderr: data => console.log(data.line), // $HighlightLine
}) // $HighlightLine

// 4. Wait for the process to finish
await proc.wait()

// 5. Or you can access output after the process has finished
const output = proc.output

await session.close()
