import { Sandbox } from 'e2b'

const sandbox = await Sandbox.create({ template: 'base' })

// `filesystem.write()` will:
// - create the file if it doesn't exist
// - fail if any directory in the path doesn't exist
// - overwrite the file if it exists

// Write the content of the file '/hello.txt'
await sandbox.filesystem.write('/hello.txt', 'Hello World!') // $HighlightLine

// The following would fail because '/dir' doesn't exist
// await sandbox.filesystem.write("/dir/hello.txt", "Hello World!")

await sandbox.close()
