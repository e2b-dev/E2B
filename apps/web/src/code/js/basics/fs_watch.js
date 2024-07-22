import { Sandbox } from 'e2b'

const sandbox = await Sandbox.create({ template: 'base' })

// Start filesystem watcher for the /home directory
const watcher = sandbox.filesystem.watchDir('/home') // $HighlightLine
watcher.addEventListener((event) => {
  // $HighlightLine
  console.log('Filesystem event', event) // $HighlightLine
}) // $HighlightLine
await watcher.start() // $HighlightLine

// Create files in the /home directory inside the playground
// We'll receive notifications for these events through the watcher we created above.
for (let i = 0; i < 10; i++) {
  console.log('Creating file', i)
  // `filesystem.write()` will trigger two events:
  // 1. 'Create' when the file is created
  // 2. 'Write' when the file is written to
  await sandbox.filesystem.write(`/home/${i}.txt`, `Hello World ${i}!`)
}

await sandbox.close()
