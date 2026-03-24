import { Sandbox } from 'e2b'

// 1. Start cloud playground
const sandbox = await Sandbox.create({
  // $HighlightLine
  template: 'base', // or you can pass your own sandbox template id
  apiKey: process.env.E2B_API_KEY,
})

// 2. Use filesystem
sandbox.filesystem // $HighlightLine

// 3. Start processes
sandbox.process.start() // $HighlightLine

// 4. Upload/download files
sandbox.read_bytes() // $HighlightLine
sandbox.write_bytes() // $HighlightLine

await sandbox.close()
