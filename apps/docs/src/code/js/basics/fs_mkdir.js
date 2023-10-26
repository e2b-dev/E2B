import { Session } from '@e2b/sdk'

const session = await Session.create({ id: 'Nodejs' })

// `filesystem.make_dir()` will fail if any directory in the path doesn't exist
// Create a new directory '/dir'
await session.filesystem.makeDir('/dir') // $HighlightLine

await session.close()
