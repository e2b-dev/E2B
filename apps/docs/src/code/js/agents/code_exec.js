import { Sandbox } from 'e2b'

// 1. Start the playground sandbox
const sandbox = await Sandbox.create({
  // You can pass your own sandbox template id
  template: 'base',
})

// 2. Save the JavaScript code to a file inside the playground
const code = `
  const fs = require('fs');
  const dirContent = fs.readdirSync('/');
  dirContent.forEach((item) => {
    console.log('Root dir item inside playground:', item);
  });
`
await sandbox.filesystem.write('/code/index.js', code)

// 3. Start the execution of the JavaScript file we saved
const proc = await sandbox.process.start({
  // $HighlightLine
  cmd: 'node /code/index.js', // $HighlightLine
  // 4. Stream stdout, stderr
  onStdout: (data) => console.log(data.line), // $HighlightLine
  onStderr: (data) => console.log(data.line), // $HighlightLine
}) // $HighlightLine

// 4. Wait for the process to finish
await proc.wait()

// 5. Or you can access output after the process has finished
const output = proc.output

await sandbox.close()
