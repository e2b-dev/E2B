import { Session } from '@e2b/sdk'

// 1. Start cloud playground
const session = await Session.create({ // $HighlightLine
  id: 'Nodejs', // or 'Bash', 'Python3', 'Java', 'Go', 'Rust', 'PHP', 'Perl', 'DotNET'
  apiKey: process.env.E2B_API_KEY,
})

// 2. Use filesystem
session.filesystem // $HighlightLine

// 3. Start processes
session.process.start() // $HighlightLine

// 4. Upload/download files
session.read_bytes() // $HighlightLine
session.write_bytes() // $HighlightLine

await session.close()
