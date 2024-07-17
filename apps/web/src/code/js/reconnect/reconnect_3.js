// Reconnect to the sandbox
const sandbox2 = await Sandbox.reconnect(sandboxID) // $HighlightLine

// Continue in using the sandbox
const content = await sandbox2.filesystem.read('hello.txt')
console.log(content)

// Close the sandbox
await sandbox2.close()
