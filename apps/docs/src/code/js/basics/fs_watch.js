import { Session } from '@e2b/sdk'

const session = await Session.create({
  id: 'Nodejs',
  apiKey: process.env.E2B_API_KEY,
})

// Start filesystem watcher for the /home directory
const watcher = session.filesystem.watchDir('/home') // $HighlightLine
watcher.addEventListener(event => {
  console.log('Filesystem event', event)
})
await watcher.start() // $HighlightLine


// Create files in the /home directory inside the playground
// We'll receive notifications for these events through the watcher we created above.
for (let i = 0; i < 10; i++) {
  console.log('Creating file', i)
  // `filesystem.write()` will trigger two events:
  // 1. 'Create' when the file is created
  // 2. 'Write' when the file is written to
  await session.filesystem.write(`/home/${i}.txt`, `Hello World ${i}!`)
}

await session.close()
