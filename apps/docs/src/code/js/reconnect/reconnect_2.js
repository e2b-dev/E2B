// Do something in the sandbox
await sandbox.filesystem.write('hello.txt', 'Hello World!')

// Get the sandbox ID, we'll need it later
const sandboxID = sandbox.id

// Keep alive the sandbox for 1 hour
await sandbox.keepAlive(60 * 60 * 1000) // 1 hour $HighlightLine

// Close the sandbox. Even if we close the sandbox, it will stay alive, because we explicitly called keepAlive().
await sandbox.close()

// Do something else...
await wait(60 * 1000)